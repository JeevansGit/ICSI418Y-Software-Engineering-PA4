import { useState, useEffect } from "react";
import Signup from "./components/Signup";
import Login from "./components/Login";
import Backlog from "./components/Backlog";

function App() {
    const [users, setUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [members, setMembers] = useState([]);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [status, setStatus] = useState("Planning");
    const [lead, setLead] = useState("");

    const [selectedProject, setSelectedProject] = useState("");
    const [selectedUser, setSelectedUser] = useState("");

    const [message, setMessage] = useState("");

    //Changes whenever a member is added or removed (so the backlog reloads members)
    const [memberVersion, setMemberVersion] = useState(0);

    //Get all registered users
    async function getUsers() {
        try {
            const response = await fetch("http://localhost:9000/users");
            const data = await response.json();
            setUsers(data.users);
        } catch (error) {
            setMessage("Server error");
        }
    }

    //Get all projects
    async function getProjects() {
        try {
            const response = await fetch("http://localhost:9000/projects");
            const data = await response.json();
            setProjects(data.projects);
        } catch (error) {
            setMessage("Server error");
        }
    }

    //Get members of selected project
    async function getMembers(projectId) {
        if (!projectId) {
            setMembers([]);
            return;
        }

        const response = await fetch(
            `http://localhost:9000/projects/${projectId}/members`
        );

        const data = await response.json();

        if (response.ok) {
            setMembers(data.members);
        } else {
            setMessage(data.message);
        }
    }

    //Load users and projects when the page opens
    useEffect(() => {
        getUsers();
        getProjects();
    }, []);

    //Load members when a project is selected
    useEffect(() => {
        getMembers(selectedProject);
    }, [selectedProject]);

    //Create a project
    async function createProject(event) {
        event.preventDefault();

        try {
            const response = await fetch("http://localhost:9000/projects", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name: name,
                    description: description,
                    status: status,
                    project_lead_id: lead
                })
            });

            const data = await response.json();

            setMessage(data.message);

            if (response.ok) {
                setName("");
                setDescription("");
                setStatus("Planning");
                setLead("");

                getProjects();
                getUsers();
            }
        } catch (error) {
            setMessage("Server error");
        }
    }

    //Add a member to a project
    async function addMember(event) {
        event.preventDefault();

        try {
            const response = await fetch(
                `http://localhost:9000/projects/${selectedProject}/members`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        user_id: selectedUser
                    })
                }
            );

            const data = await response.json();
            setMessage(data.message);

            if (response.ok) {
                setSelectedUser("");
                getMembers(selectedProject);
                setMemberVersion(memberVersion + 1);
            }
        } catch (error) {
            setMessage("Server error");
        }
    }

    //Remove a member from a project
    async function removeMember(userId) {
        try {
            const response = await fetch(
                `http://localhost:9000/projects/${selectedProject}/members/${userId}`,
                {
                    method: "DELETE"
                }
            );

            const data = await response.json();
            setMessage(data.message);

            if (response.ok) {
                getMembers(selectedProject);
                setMemberVersion(memberVersion + 1);
            }
        } catch (error) {
            setMessage("Server error");
        }
    }

    return (
        <div>
            <h1>Project Management</h1>

            <Signup />
            <Login />

            <hr />

            <h2>Create Project</h2>

            <form onSubmit={createProject}>
                <input
                    type="text"
                    placeholder="Project Name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                />

                <br /><br />

                <textarea
                    placeholder="Project Description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    required
                />

                <br /><br />

                <label>Status: </label>

                <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                >
                    <option value="Planning">Planning</option>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                </select>

                <br /><br />

                <label>Project Lead: </label>

                <select
                    value={lead}
                    onChange={(event) => setLead(event.target.value)}
                    required
                >
                    <option value="">Select a user</option>

                    {users.map((user) => (
                        <option key={user._id} value={user._id}>
                            {user.f_name} {user.l_name} ({user.username})
                        </option>
                    ))}
                </select>

                <br /><br />

                <button type="submit">Create Project</button>
            </form>

            <hr />

            <h2>View Projects</h2>

            {projects.length === 0 && <p>No projects created yet.</p>}

            {projects.map((project) => (
                <div key={project._id}>
                    <h3>{project.name}</h3>

                    <p>Description: {project.description}</p>

                    <p>Status: {project.status}</p>

                    <p>
                        Project Lead:{" "}
                        {project.projectLead
                            ? `${project.projectLead.f_name} ${project.projectLead.l_name}`
                            : "Unknown"}
                    </p>

                    <button
                        onClick={() => setSelectedProject(project._id)}
                    >
                        Manage Members
                    </button>

                    <hr />
                </div>
            ))}

            <h2>Manage Project Members</h2>

            <label>Select Project: </label>

            <select
                value={selectedProject}
                onChange={(event) => setSelectedProject(event.target.value)}
            >
                <option value="">Select a project</option>

                {projects.map((project) => (
                    <option key={project._id} value={project._id}>
                        {project.name}
                    </option>
                ))}
            </select>

            {selectedProject && (
                <div>
                    <h3>Current Members</h3>

                    {members.map((member) => (
                        <div key={member._id}>
                            <p>
                                {member.f_name} {member.l_name} ({member.username})
                            </p>

                            {projects.find(
                                (project) => project._id === selectedProject
                            )?.project_lead_id === member._id ? (
                                <p>Project Lead (Cannot Remove)</p>
                            ) : (
                                <button
                                    onClick={() => removeMember(member._id)}
                                >
                                    Remove Member
                                </button>
                            )}
                        </div>
                    ))}

                    <h3>Add Member</h3>

                    <form onSubmit={addMember}>
                        <select
                            value={selectedUser}
                            onChange={(event) => setSelectedUser(event.target.value)}
                            required
                        >
                            <option value="">Select a user</option>

                            {users.map((user) => (
                                <option key={user._id} value={user._id}>
                                    {user.f_name} {user.l_name} ({user.username})
                                </option>
                            ))}
                        </select>

                        <button type="submit">Add Member</button>
                    </form>
                </div>
            )}

            <p>{message}</p>

            <hr />

            <Backlog projects={projects} memberVersion={memberVersion} />
        </div>
    );
}

export default App;