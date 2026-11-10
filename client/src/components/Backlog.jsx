import { useState, useEffect } from "react";

function Backlog({ projects, memberVersion }) {
    const [selectedProject, setSelectedProject] = useState("");
    const [members, setMembers] = useState([]);
    const [stories, setStories] = useState([]);

    //Create story form
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState("Medium");
    const [assignedUser, setAssignedUser] = useState("");

    //Story details and editing
    const [detailsId, setDetailsId] = useState("");
    const [editingId, setEditingId] = useState("");
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editPriority, setEditPriority] = useState("Medium");
    const [editStatus, setEditStatus] = useState("To Do");
    const [editAssignedUser, setEditAssignedUser] = useState("");

    const [message, setMessage] = useState("");

    //Get members of selected project (for the assignment dropdowns)
    async function getMembers(projectId) {
        if (!projectId) {
            setMembers([]);
            return;
        }

        try {
            const response = await fetch(
                `http://localhost:9000/projects/${projectId}/members`
            );

            const data = await response.json();

            if (response.ok) {
                setMembers(data.members);
            } else {
                setMessage(data.message);
            }
        } catch (error) {
            setMessage("Server error");
        }
    }

    //Get stories of selected project
    async function getStories(projectId) {
        if (!projectId) {
            setStories([]);
            return;
        }

        try {
            const response = await fetch(
                `http://localhost:9000/projects/${projectId}/stories`
            );

            const data = await response.json();

            if (response.ok) {
                setStories(data.stories);
            } else {
                setMessage(data.message);
            }
        } catch (error) {
            setMessage("Server error");
        }
    }

    //Load members and stories when a project is selected
    //(also reloads members if a member was added or removed above)
    useEffect(() => {
        getMembers(selectedProject);
        getStories(selectedProject);
    }, [selectedProject, memberVersion]);

    //Change project: show only its stories and close details / edit form
    function changeProject(projectId) {
        setSelectedProject(projectId);
        setStories([]);
        setMembers([]);
        setDetailsId("");
        setEditingId("");
        setTitle("");
        setDescription("");
        setPriority("Medium");
        setAssignedUser("");
        setMessage("");
    }

    //Create a user story
    async function createStory(event) {
        event.preventDefault();

        //Frontend validation
        if (title.trim() === "" || description.trim() === "") {
            setMessage("Title and description cannot be blank");
            return;
        }

        try {
            const response = await fetch(
                `http://localhost:9000/projects/${selectedProject}/stories`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        title: title,
                        description: description,
                        priority: priority,
                        assigned_user_id: assignedUser === "" ? null : assignedUser
                    })
                }
            );

            const data = await response.json();
            setMessage(data.message);

            if (response.ok) {
                setTitle("");
                setDescription("");
                setPriority("Medium");
                setAssignedUser("");
                getStories(selectedProject);
            }
        } catch (error) {
            setMessage("Server error");
        }
    }

    //Open the edit form with the story's existing values
    function startEdit(story) {
        setEditingId(story._id);
        setEditTitle(story.title);
        setEditDescription(story.description);
        setEditPriority(story.priority);
        setEditStatus(story.status);
        setEditAssignedUser(story.assigned_user_id || "");
        setMessage("");
    }

    //Cancel editing (nothing is saved)
    function cancelEdit() {
        setEditingId("");
        setMessage("");
    }

    //Save an edited story
    async function saveEdit(event) {
        event.preventDefault();

        //Frontend validation
        if (editTitle.trim() === "" || editDescription.trim() === "") {
            setMessage("Title and description cannot be blank");
            return;
        }

        try {
            const response = await fetch(
                `http://localhost:9000/projects/${selectedProject}/stories/${editingId}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        title: editTitle,
                        description: editDescription,
                        priority: editPriority,
                        status: editStatus,
                        assigned_user_id:
                            editAssignedUser === "" ? null : editAssignedUser
                    })
                }
            );

            const data = await response.json();
            setMessage(data.message);

            if (response.ok) {
                setEditingId("");
                getStories(selectedProject);
            }
        } catch (error) {
            setMessage("Server error");
        }
    }

    //Delete a story after confirmation
    async function deleteStory(story) {
        const confirmed = window.confirm(
            `Delete the story "${story.title}"?`
        );

        if (!confirmed) {
            return;
        }

        try {
            const response = await fetch(
                `http://localhost:9000/projects/${selectedProject}/stories/${story._id}`,
                {
                    method: "DELETE"
                }
            );

            const data = await response.json();
            setMessage(data.message);

            if (response.ok) {
                if (detailsId === story._id) {
                    setDetailsId("");
                }

                if (editingId === story._id) {
                    setEditingId("");
                }

                getStories(selectedProject);
            }
        } catch (error) {
            setMessage("Server error");
        }
    }

    return (
        <div>
            <h2>Project Backlog</h2>

            <label>Select Project: </label>

            <select
                value={selectedProject}
                onChange={(event) => changeProject(event.target.value)}
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
                    <h3>Create User Story</h3>

                    <form onSubmit={createStory}>
                        <input
                            type="text"
                            placeholder="Story Title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            required
                        />

                        <br /><br />

                        <textarea
                            placeholder="As a [type of user], I want [goal], so that [benefit]."
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            required
                        />

                        <br /><br />

                        <label>Priority: </label>

                        <select
                            value={priority}
                            onChange={(event) => setPriority(event.target.value)}
                        >
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                        </select>

                        <br /><br />

                        <label>Assigned Member: </label>

                        <select
                            value={assignedUser}
                            onChange={(event) => setAssignedUser(event.target.value)}
                        >
                            <option value="">Unassigned</option>

                            {members.map((member) => (
                                <option key={member._id} value={member._id}>
                                    {member.f_name} {member.l_name} ({member.username})
                                </option>
                            ))}
                        </select>

                        <br /><br />

                        <button type="submit">Create Story</button>
                    </form>

                    <hr />

                    <h3>Backlog</h3>

                    {stories.length === 0 && (
                        <p>This project has no user stories yet.</p>
                    )}

                    {stories.map((story) => (
                        <div key={story._id}>
                            {editingId === story._id ? (
                                <form onSubmit={saveEdit}>
                                    <h4>Edit Story</h4>

                                    <input
                                        type="text"
                                        placeholder="Story Title"
                                        value={editTitle}
                                        onChange={(event) => setEditTitle(event.target.value)}
                                        required
                                    />

                                    <br /><br />

                                    <textarea
                                        placeholder="Story Description"
                                        value={editDescription}
                                        onChange={(event) =>
                                            setEditDescription(event.target.value)
                                        }
                                        required
                                    />

                                    <br /><br />

                                    <label>Priority: </label>

                                    <select
                                        value={editPriority}
                                        onChange={(event) =>
                                            setEditPriority(event.target.value)
                                        }
                                    >
                                        <option value="High">High</option>
                                        <option value="Medium">Medium</option>
                                        <option value="Low">Low</option>
                                    </select>

                                    <br /><br />

                                    <label>Status: </label>

                                    <select
                                        value={editStatus}
                                        onChange={(event) =>
                                            setEditStatus(event.target.value)
                                        }
                                    >
                                        <option value="To Do">To Do</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Done">Done</option>
                                    </select>

                                    <br /><br />

                                    <label>Assigned Member: </label>

                                    <select
                                        value={editAssignedUser}
                                        onChange={(event) =>
                                            setEditAssignedUser(event.target.value)
                                        }
                                    >
                                        <option value="">Unassigned</option>

                                        {members.map((member) => (
                                            <option key={member._id} value={member._id}>
                                                {member.f_name} {member.l_name} (
                                                {member.username})
                                            </option>
                                        ))}
                                    </select>

                                    <br /><br />

                                    <button type="submit">Save</button>

                                    <button type="button" onClick={cancelEdit}>
                                        Cancel
                                    </button>
                                </form>
                            ) : (
                                <div>
                                    <h4>{story.title}</h4>

                                    <p>Priority: {story.priority}</p>

                                    <p>Status: {story.status}</p>

                                    <p>
                                        Assigned Member:{" "}
                                        {story.assignedUser
                                            ? `${story.assignedUser.f_name} ${story.assignedUser.l_name} (${story.assignedUser.username})`
                                            : "Unassigned"}
                                    </p>

                                    {detailsId === story._id && (
                                        <p>Description: {story.description}</p>
                                    )}

                                    <button
                                        onClick={() =>
                                            setDetailsId(
                                                detailsId === story._id ? "" : story._id
                                            )
                                        }
                                    >
                                        {detailsId === story._id
                                            ? "Hide Details"
                                            : "View Details"}
                                    </button>

                                    <button onClick={() => startEdit(story)}>
                                        Edit
                                    </button>

                                    <button onClick={() => deleteStory(story)}>
                                        Delete
                                    </button>
                                </div>
                            )}

                            <hr />
                        </div>
                    ))}
                </div>
            )}

            <p>{message}</p>
        </div>
    );
}

export default Backlog;