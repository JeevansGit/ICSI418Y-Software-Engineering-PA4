//Create all imports and establish a connection
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");

const app = express();

app.use(express.json());
app.use(cors());

const client = new MongoClient(process.env.MONGO_URI);
const db = client.db("pa2");

const users = db.collection("users");
const projects = db.collection("Projects");
const memberships = db.collection("ProjectMemberships");
const stories = db.collection("UserStories");

//Connect to MongoDB
async function connectDB() {
    await client.connect();
    console.log("Connected to MongoDB");
}

//Check if ID is valid
function validID(id) {
    return ObjectId.isValid(id) &&
        new ObjectId(id).toString() === id;
}

//Valid story values
const PRIORITIES = ["High", "Medium", "Low"];
const STORY_STATUSES = ["To Do", "In Progress", "Done"];

//Check that a required text value is a nonblank string
function validText(value) {
    return typeof value === "string" && value.trim() !== "";
}

//Check the assigned user for a story
//Returns an error object, or null if the assignment is valid
async function checkAssignment(project, assignedUserId) {
    //Unassigned is allowed
    if (assignedUserId === null) {
        return null;
    }

    if (!validID(assignedUserId)) {
        return { code: 400, message: "Invalid assigned user" };
    }

    const user = await users.findOne({
        _id: new ObjectId(assignedUserId)
    });

    if (!user) {
        return { code: 404, message: "Assigned user does not exist" };
    }

    //Assigned user must be a member of the same project
    const membership = await memberships.findOne({
        project_id: project._id,
        user_id: user._id
    });

    if (!membership) {
        return {
            code: 400,
            message: "Assigned user is not a member of this project"
        };
    }

    return null;
}

//Turn "" or missing into null (Unassigned)
function cleanAssignedUser(value) {
    if (value === undefined || value === null || value === "") {
        return null;
    }

    return value;
}

//Test server
app.get("/", (req, res) => {
    res.json({ message: "Server Is Up" });
});


//SIGNUP - PA2
app.post("/signup", async (req, res) => {
    try {
        const f_name = req.body.f_name;
        const l_name = req.body.l_name;
        const username = req.body.username;
        const password = req.body.password;

        if (!f_name || !l_name || !username || !password) {
            return res.json({ message: "All Fields Are Required" });
        }

        const existingUser = await users.findOne({ username: username });

        if (existingUser) {
            return res.json({ message: "Username Already Exists" });
        }

        await users.insertOne({
            f_name: f_name,
            l_name: l_name,
            username: username,
            password: password
        });

        res.json({ message: "User Created Successfully" });

    } catch (error) {
        res.status(500).json({ message: "Server or database error" });
    }
});


//LOGIN - PA2
app.post("/login", async (req, res) => {
    try {
        const username = req.body.username;
        const password = req.body.password;

        if (!username || !password) {
            return res.json({
                message: "Username and password are required"
            });
        }

        const user = await users.findOne({ username: username });

        if (!user || user.password !== password) {
            return res.json({
                message: "Invalid username or password"
            });
        }

        res.json({ message: "Login successful" });

    } catch (error) {
        res.status(500).json({ message: "Server or database error" });
    }
});


//GET ALL USERS
app.get("/users", async (req, res) => {
    try {
        const allUsers = await users.find(
            {},
            { projection: { password: 0 } }
        ).toArray();

        res.json({
            users: allUsers.map((user) => ({
                ...user,
                _id: user._id.toString()
            }))
        });

    } catch (error) {
        res.status(500).json({ message: "Could not get users" });
    }
});


//CREATE PROJECT
app.post("/projects", async (req, res) => {
    try {
        const { name, description, status, project_lead_id } = req.body;

        //Check required fields
        if (!name || !description || !status || !project_lead_id) {
            return res.status(400).json({
                message: "All project fields are required"
            });
        }

        //Check status
        if (!["Planning", "Active", "Completed"].includes(status)) {
            return res.status(400).json({
                message: "Invalid project status"
            });
        }

        //Check if lead ID is valid
        if (!validID(project_lead_id)) {
            return res.status(400).json({
                message: "Invalid Project Lead"
            });
        }

        //Check if Project Lead exists
        const lead = await users.findOne({
            _id: new ObjectId(project_lead_id)
        });

        if (!lead) {
            return res.status(404).json({
                message: "Project Lead does not exist"
            });
        }

        //Create project document
        const newProject = {
            name: name,
            description: description,
            status: status,
            project_lead_id: lead._id
        };

        const result = await projects.insertOne(newProject);

        //Automatically add Project Lead as a member
        await memberships.insertOne({
            project_id: result.insertedId,
            user_id: lead._id
        });

        res.status(201).json({
            message: "Project created successfully"
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Server or database error"
        });
    }
});


//GET ALL PROJECTS
app.get("/projects", async (req, res) => {
    try {
        const allProjects = await projects.aggregate([
            {
                $lookup: {
                    from: "users",
                    localField: "project_lead_id",
                    foreignField: "_id",
                    as: "projectLead"
                }
            },
            {
                $unwind: {
                    path: "$projectLead",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    name: 1,
                    description: 1,
                    status: 1,
                    project_lead_id: 1,
                    "projectLead.f_name": 1,
                    "projectLead.l_name": 1,
                    "projectLead.username": 1
                }
            }
        ]).toArray();

        res.json({
            projects: allProjects.map((project) => ({
                ...project,
                _id: project._id.toString(),
                project_lead_id: project.project_lead_id.toString()
            }))
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Could not retrieve projects"
        });
    }
});


//GET PROJECT MEMBERS
app.get("/projects/:projectId/members", async (req, res) => {
    try {
        const projectId = req.params.projectId;

        if (!validID(projectId)) {
            return res.status(400).json({
                message: "Invalid project ID"
            });
        }

        const project = await projects.findOne({
            _id: new ObjectId(projectId)
        });

        if (!project) {
            return res.status(404).json({
                message: "Project does not exist"
            });
        }

        const projectMembers = await memberships.aggregate([
            {
                $match: {
                    project_id: project._id
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "user_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            {
                $unwind: "$user"
            },
            {
                $project: {
                    _id: "$user._id",
                    f_name: "$user.f_name",
                    l_name: "$user.l_name",
                    username: "$user.username"
                }
            }
        ]).toArray();

        res.json({
            members: projectMembers.map((member) => ({
                ...member,
                _id: member._id.toString()
            }))
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Could not retrieve members"
        });
    }
});


//ADD MEMBER TO PROJECT
app.post("/projects/:projectId/members", async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const userId = req.body.user_id;

        if (!validID(projectId) || !validID(userId)) {
            return res.status(400).json({
                message: "Invalid project or user ID"
            });
        }

        //Check if project exists
        const project = await projects.findOne({
            _id: new ObjectId(projectId)
        });

        if (!project) {
            return res.status(404).json({
                message: "Project does not exist"
            });
        }

        //Check if user exists
        const user = await users.findOne({
            _id: new ObjectId(userId)
        });

        if (!user) {
            return res.status(404).json({
                message: "User does not exist"
            });
        }

        //Prevent duplicate memberships
        const existingMember = await memberships.findOne({
            project_id: project._id,
            user_id: user._id
        });

        if (existingMember) {
            return res.status(409).json({
                message: "User is already a member of this project"
            });
        }

        //Create membership document
        await memberships.insertOne({
            project_id: project._id,
            user_id: user._id
        });

        res.status(201).json({
            message: "Member added successfully"
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Could not add member"
        });
    }
});


//REMOVE MEMBER FROM PROJECT
app.delete("/projects/:projectId/members/:userId", async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const userId = req.params.userId;

        if (!validID(projectId) || !validID(userId)) {
            return res.status(400).json({
                message: "Invalid project or user ID"
            });
        }

        const project = await projects.findOne({
            _id: new ObjectId(projectId)
        });

        if (!project) {
            return res.status(404).json({
                message: "Project does not exist"
            });
        }

        const user = await users.findOne({
            _id: new ObjectId(userId)
        });

        if (!user) {
            return res.status(404).json({
                message: "User does not exist"
            });
        }

        //Project Lead cannot be removed
        if (project.project_lead_id.equals(user._id)) {
            return res.status(400).json({
                message: "The Project Lead cannot be removed"
            });
        }

        //Member cannot be removed while they still have stories in this project
        //(any status, including Done). Stories in other projects do not matter.
        const assignedStories = await stories.countDocuments({
            project_id: project._id,
            assigned_user_id: user._id
        });

        if (assignedStories > 0) {
            return res.status(400).json({
                message: "This member still has stories assigned in this project. " +
                    "The stories must first be reassigned, unassigned, or deleted"
            });
        }

        const result = await memberships.deleteOne({
            project_id: project._id,
            user_id: user._id
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                message: "User is not a member of this project"
            });
        }

        res.json({
            message: "Member removed successfully"
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Could not remove member"
        });
    }
});


//CREATE USER STORY
app.post("/projects/:projectId/stories", async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const { title, description, priority } = req.body;
        const assignedUserId = cleanAssignedUser(req.body.assigned_user_id);

        if (!validID(projectId)) {
            return res.status(400).json({
                message: "Invalid project ID"
            });
        }

        //Check required fields
        if (!validText(title) || !validText(description) || !priority) {
            return res.status(400).json({
                message: "Title, description, and priority are required"
            });
        }

        //Check priority
        if (!PRIORITIES.includes(priority)) {
            return res.status(400).json({
                message: "Invalid priority"
            });
        }

        //Check if project exists
        const project = await projects.findOne({
            _id: new ObjectId(projectId)
        });

        if (!project) {
            return res.status(404).json({
                message: "Project does not exist"
            });
        }

        //Check assigned member
        const assignmentError = await checkAssignment(project, assignedUserId);

        if (assignmentError) {
            return res.status(assignmentError.code).json({
                message: assignmentError.message
            });
        }

        //Create story document (status always starts as To Do)
        await stories.insertOne({
            project_id: project._id,
            title: title.trim(),
            description: description.trim(),
            priority: priority,
            status: "To Do",
            assigned_user_id: assignedUserId === null
                ? null
                : new ObjectId(assignedUserId)
        });

        res.status(201).json({
            message: "User story created successfully"
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Server or database error"
        });
    }
});


//GET PROJECT BACKLOG (ALL STORIES FOR ONE PROJECT)
app.get("/projects/:projectId/stories", async (req, res) => {
    try {
        const projectId = req.params.projectId;

        if (!validID(projectId)) {
            return res.status(400).json({
                message: "Invalid project ID"
            });
        }

        const project = await projects.findOne({
            _id: new ObjectId(projectId)
        });

        if (!project) {
            return res.status(404).json({
                message: "Project does not exist"
            });
        }

        const projectStories = await stories.aggregate([
            {
                $match: {
                    project_id: project._id
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "assigned_user_id",
                    foreignField: "_id",
                    as: "assignedUser"
                }
            },
            {
                $unwind: {
                    path: "$assignedUser",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $project: {
                    project_id: 1,
                    title: 1,
                    description: 1,
                    priority: 1,
                    status: 1,
                    assigned_user_id: 1,
                    "assignedUser.f_name": 1,
                    "assignedUser.l_name": 1,
                    "assignedUser.username": 1
                }
            },
            {
                $sort: { _id: 1 }
            }
        ]).toArray();

        res.json({
            stories: projectStories.map((story) => ({
                ...story,
                _id: story._id.toString(),
                project_id: story.project_id.toString(),
                assigned_user_id: story.assigned_user_id
                    ? story.assigned_user_id.toString()
                    : null
            }))
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Could not retrieve stories"
        });
    }
});


//EDIT USER STORY
app.put("/projects/:projectId/stories/:storyId", async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const storyId = req.params.storyId;
        const { title, description, priority, status } = req.body;
        const assignedUserId = cleanAssignedUser(req.body.assigned_user_id);

        if (!validID(projectId) || !validID(storyId)) {
            return res.status(400).json({
                message: "Invalid project or story ID"
            });
        }

        //Check required fields
        if (!validText(title) || !validText(description) || !priority || !status) {
            return res.status(400).json({
                message: "Title, description, priority, and status are required"
            });
        }

        //Check priority and status
        if (!PRIORITIES.includes(priority)) {
            return res.status(400).json({
                message: "Invalid priority"
            });
        }

        if (!STORY_STATUSES.includes(status)) {
            return res.status(400).json({
                message: "Invalid story status"
            });
        }

        //Check if project exists
        const project = await projects.findOne({
            _id: new ObjectId(projectId)
        });

        if (!project) {
            return res.status(404).json({
                message: "Project does not exist"
            });
        }

        //Story must exist AND belong to this project
        const story = await stories.findOne({
            _id: new ObjectId(storyId),
            project_id: project._id
        });

        if (!story) {
            return res.status(404).json({
                message: "Story does not exist in this project"
            });
        }

        //Check assigned member
        const assignmentError = await checkAssignment(project, assignedUserId);

        if (assignmentError) {
            return res.status(assignmentError.code).json({
                message: assignmentError.message
            });
        }

        //Update the existing document (project_id is never changed)
        await stories.updateOne(
            { _id: story._id, project_id: project._id },
            {
                $set: {
                    title: title.trim(),
                    description: description.trim(),
                    priority: priority,
                    status: status,
                    assigned_user_id: assignedUserId === null
                        ? null
                        : new ObjectId(assignedUserId)
                }
            }
        );

        res.json({
            message: "User story updated successfully"
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Could not update story"
        });
    }
});


//DELETE USER STORY
app.delete("/projects/:projectId/stories/:storyId", async (req, res) => {
    try {
        const projectId = req.params.projectId;
        const storyId = req.params.storyId;

        if (!validID(projectId) || !validID(storyId)) {
            return res.status(400).json({
                message: "Invalid project or story ID"
            });
        }

        const project = await projects.findOne({
            _id: new ObjectId(projectId)
        });

        if (!project) {
            return res.status(404).json({
                message: "Project does not exist"
            });
        }

        const result = await stories.deleteOne({
            _id: new ObjectId(storyId),
            project_id: project._id
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({
                message: "Story does not exist in this project"
            });
        }

        res.json({
            message: "User story deleted successfully"
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({
            message: "Could not delete story"
        });
    }
});


//Start server after connecting to MongoDB
connectDB()
    .then(() => {
        app.listen(9000, () => {
            console.log("Server running on port 9000");
        });
    })
    .catch((error) => {
        console.log("Database connection failed:", error);
    });