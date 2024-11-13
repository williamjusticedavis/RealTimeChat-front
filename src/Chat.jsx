import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import EmojiPicker from "emoji-picker-react";
import socket from "./socket";
import axios from "axios";

function Chat() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(null);
  const [showReactions, setShowReactions] = useState(null);
  const userId = localStorage.getItem("userId");
  const navigate = useNavigate();

  const messageIds = useRef(new Set());

  // Emit reaction event to server
  const handleReaction = async (emoji, messageId) => {
    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/chat/react`, {
        messageId,
        emoji,
        userId,
      });
      socket.emit("addReaction", { messageId, emoji, userId });
    } catch (error) {
      console.error("Failed to react to message", error);
    }
  };

  // Remove reaction event from server
  const removeReaction = async (emoji, messageId) => {
    try {
      await axios.post(`${import.meta.env.VITE_BACKEND_URL}/chat/removeReaction`, {
        messageId,
        emoji,
        userId,
      });
      socket.emit("removeReaction", { messageId, emoji, userId });
    } catch (error) {
      console.error("Failed to remove reaction", error);
    }
  };

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
    socket.emit("joinRoom", userId);

    // Listen for incoming messages and updated reactions
    socket.on("newMessage", (message) => {
      if (!messageIds.current.has(message._id)) {
        messageIds.current.add(message._id);
        setMessages((prevMessages) => [...prevMessages, message]);
      }
    });

    socket.on("updateReactions", ({ messageId, emojisReacted }) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === messageId ? { ...msg, emojisReacted } : msg
        )
      );
    });

    return () => {
      socket.off("newMessage");
      socket.off("updateReactions");
    };
  }, [userId, selectedUser]);

  const handleUserSelect = async (user) => {
    setSelectedUser(user);
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/chat/messages/${userId}/${user._id}`
      );
      setMessages(response.data);
      messageIds.current.clear();
      response.data.forEach((msg) => messageIds.current.add(msg._id));
    } catch (error) {
      console.error("Failed to fetch messages", error);
    }
  };

  const sendMessage = async () => {
    if (input.trim() && selectedUser && !loading) {
      const newMessage = {
        senderId: userId,
        receiverId: selectedUser._id,
        content: input,
      };

      setLoading(true);

      try {
        const response = await axios.post(`${import.meta.env.VITE_BACKEND_URL}/chat/send`, newMessage);
        messageIds.current.add(response.data._id);
        setMessages((prevMessages) => [...prevMessages, response.data]);
        setInput("");
      } catch (error) {
        console.error("Failed to send message", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const togglePicker = (messageId) => {
    setShowPicker((prev) => (prev === messageId ? null : messageId));
  };

  const onEmojiClick = (emojiData, messageId) => {
    handleReaction(emojiData.emoji, messageId);
    setShowPicker(null);
  };

  const toggleReactionsDisplay = (messageId) => {
    setShowReactions((prev) => (prev === messageId ? null : messageId));
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("userId");
    navigate("/");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !loading) {
      sendMessage();
    }
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
              className={`p-2 cursor-pointer rounded ${selectedUser && selectedUser._id === user._id
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
                <div key={index} className={`relative mb-4 flex ${msg.sender === userId ? "justify-end" : "justify-start"}`}>
                  {/* Message Content */}
                  <div
                    className={`relative p-2 max-w-xs rounded-lg ${msg.sender === userId
                        ? "bg-blue-500 text-white rounded-br-none"
                        : "bg-gray-300 text-gray-800 rounded-bl-none"
                      }`}
                  >
                    {msg.content}

                    {/* Reaction Button (+) */}
                    <button
                      className="text-gray-500 hover:text-gray-700 ml-1 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePicker(msg._id);
                      }}
                    >
                      +
                    </button>

                    {/* Display Reactions */}
                    {msg.emojisReacted && msg.emojisReacted.map((reaction, idx) => (
                      <span
                        key={idx}
                        className="absolute top-0 right-0 transform translate-x-1/2 -translate-y-1/2 bg-gray-200 rounded-full p-1 text-xl cursor-pointer"
                        onClick={() => toggleReactionsDisplay(msg._id)}
                      >
                        {reaction.emoji}
                      </span>
                    ))}
                  </div>

                  {/* Reaction Picker */}
                  {showPicker === msg._id && (
                    <div
                      className={`emoji-picker-container absolute z-10 ${index > messages.length / 2 ? 'bottom-full' : 'top-full'
                        }`}
                      style={{
                        transform: 'translateY(10px)',
                        backgroundColor: 'white',
                        boxShadow: '0px 4px 8px rgba(0,0,0,0.2)',
                        padding: '0.5rem',
                        borderRadius: '8px',
                      }}
                    >
                      <EmojiPicker
                        onEmojiClick={(emojiData) => onEmojiClick(emojiData, msg._id)}
                        disableAutoFocus
                        native
                      />
                    </div>
                  )}

                  {/* Reaction Details with Option to Remove */}
                  {showReactions === msg._id && (
                    <div className="absolute top-full right-0 mt-2 bg-white border border-gray-300 shadow-md p-2 rounded w-40 z-10">
                      <ul className="space-y-1">
                        {msg.emojisReacted.map((reaction, idx) => (
                          <li key={idx} className="flex justify-between items-center">
                            <span>{reaction.emoji} - {reaction.reactedBy === userId ? "You" : reaction.reactedBy.username}</span>
                            {reaction.reactedBy === userId && (
                              <button
                                className="text-red-500 text-xs"
                                onClick={() => removeReaction(reaction.emoji, msg._id)}
                              >
                                Remove
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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
              onKeyPress={handleKeyPress}
            />
            <button
              className={`ml-2 px-4 py-2 rounded text-white ${loading ? "bg-gray-400" : "bg-blue-500 hover:bg-blue-600"}`}
              onClick={sendMessage}
              disabled={loading}
            >
              {loading ? "Sending..." : "Send"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;
