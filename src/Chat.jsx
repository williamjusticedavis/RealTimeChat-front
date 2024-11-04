import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";

// Connect to Socket.IO server
const socket = io(import.meta.env.VITE_BACKEND_URL);

function Chat() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const userId = localStorage.getItem("userId");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/auth/users`);
        setUsers(response.data);
      } catch (error) {
        console.error("Failed to fetch users", error);
      }
    };

    fetchUsers();

    // Join the user's unique room for real-time updates
    socket.emit("joinRoom", userId);

    // Listen for incoming messages
    socket.on("newMessage", (message) => {
      // Only add the message if it's from the selected user or sent by the current user
      if (
        (message.sender === selectedUser?._id && message.receiver === userId) ||
        (message.sender === userId && message.receiver === selectedUser?._id)
      ) {
        setMessages((prevMessages) => [...prevMessages, message]);
      }
    });

    return () => {
      socket.off("newMessage");
    };
  }, [userId, selectedUser]);

  const handleUserSelect = async (user) => {
    setSelectedUser(user);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/chat/messages/${userId}/${user._id}`
      );
      setMessages(response.data);
    } catch (error) {
      console.error("Failed to fetch messages", error);
    }
  };

  const sendMessage = async () => {
    if (input.trim() && selectedUser) {
      const newMessage = {
        senderId: userId,
        receiverId: selectedUser._id,
        content: input,
      };
      
      try {
        const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/chat/send`, newMessage);
        setMessages((prevMessages) => [...prevMessages, response.data]);
        setInput("");
      } catch (error) {
        console.error("Failed to send message", error);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("userId");
    navigate("/");
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-1/4 bg-gray-100 border-r border-gray-300">
        <header className="p-4 bg-blue-500 text-white text-center font-bold text-xl">
          Welcome, {localStorage.getItem("username")}!
        </header>
        <ul className="p-4 space-y-2">
          {users.map((user, index) => (
            <li
              key={index}
              onClick={() => handleUserSelect(user)}
              className={`p-2 cursor-pointer rounded ${
                selectedUser && selectedUser._id === user._id
                  ? "bg-blue-300 text-white"
                  : "bg-gray-200 hover:bg-gray-300"
              }`}
            >
              {user.username}
            </li>
          ))}
        </ul>
      </div>

      {/* Chat Area */}
      <div className="w-3/4 flex flex-col">
        <header className="p-4 bg-blue-500 text-white flex justify-between items-center">
          <span>{selectedUser ? `Chat with ${selectedUser.username}` : "Select a user to start chatting"}</span>
          <button
            onClick={handleLogout}
            className="bg-red-500 px-4 py-1 rounded text-white hover:bg-red-600"
          >
            Logout
          </button>
        </header>

        {/* Messages Area */}
        <div className="flex-grow p-4 bg-gray-50 overflow-y-auto">
          {selectedUser ? (
            messages.length > 0 ? (
              messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex mb-2 ${
                    msg.sender === userId ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`p-2 max-w-xs rounded-lg ${
                      msg.sender === userId
                        ? "bg-blue-500 text-white self-end rounded-br-none"
                        : "bg-gray-300 text-gray-800 self-start rounded-bl-none"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No messages yet.</p>
            )
          ) : (
            <p className="text-gray-500 text-center mt-8">Select a user to start chatting</p>
          )}
        </div>

        {/* Message Input */}
        {selectedUser && (
          <div className="p-4 border-t border-gray-300 flex">
            <input
              type="text"
              placeholder="Type a message..."
              className="flex-grow p-2 border rounded"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button
              className="ml-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              onClick={sendMessage}
            >
              Send
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;