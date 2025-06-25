import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { cannedResponses } from './cannedResponses'; // Reverted: Importing cannedResponses from its own file


// Chatbot component - now designed to be embedded or pop-out
// It now also accepts an 'onClose' prop to allow the parent to collapse it.
// chatHistory and setChatHistory are now passed as props
function ChatbotComponent({
  onChatOpen,
  initialQuestion,
  onClose,
  chatHistory, // Received as prop
  setChatHistory, // Received as prop
}: {
  onChatOpen?: () => void;
  initialQuestion?: string;
  onClose?: () => void;
  chatHistory: { role: string; text: string }[]; // Type for chatHistory prop
  setChatHistory: React.Dispatch<React.SetStateAction<{ role: string; text: string }[]>>; // Type for setChatHistory prop
}) {
  // State to store the user's current input in the text field
  const [userInput, setUserInput] = useState<string>('');
  // State to manage the loading status (e.g., when waiting for API response)
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // Ref to automatically scroll to the bottom of the chat window
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Effect to scroll to the latest message whenever chatHistory updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Effect to add a welcome message or process initial question when the component mounts or initialQuestion changes
  useEffect(() => {
    // If an initial question is provided, always start a new conversation with it
    if (initialQuestion) {
      setChatHistory([
        { role: 'model', text: "Hello! I'm your expert AI assistant for B2B financial services. How can I help you today with information on our platform's solutions?" },
        { role: 'user', text: initialQuestion }
      ]);
      const timer = setTimeout(() => {
        sendMessage(initialQuestion);
      }, 100);
      return () => clearTimeout(timer);
    }
    // IMPORTANT: Do NOT add a welcome message here if chatHistory is empty,
    // as chatHistory is now managed by the parent (App.tsx) and will be populated
    // with a welcome message on App mount.

    // Call onChatOpen if provided
    if (onChatOpen) {
      onChatOpen();
    }
  }, [initialQuestion]); // Dependent only on initialQuestion for starting new chats or re-triggering on new search

  /**
   * Handles sending a message to the Gemini API.
   * Updates chat history, calls the API, and processes the response.
   */
  const sendMessage = async (questionToSend?: string) => {
    const messageContent = questionToSend || userInput.trim();
    if (messageContent === '' || isLoading) {
      return;
    }

    const newMessage = { role: 'user', text: messageContent };
    // Only add to history if it's not an initial programmatic send that's already in history
    if (!questionToSend) {
      // If it's a new message from the input field, add it to history and clear input
      setChatHistory((prevHistory) => [...prevHistory, newMessage]);
      setUserInput(''); // Clear the input field
    }
    setIsLoading(true); // Set loading state to true

    try {
      // Check for canned responses first using the new flexible 'test' function
      for (const rule of cannedResponses) {
        if (rule.test(messageContent)) {
          setChatHistory((prevHistory) => {
            // Avoid duplicate if the last entry is already this canned response
            const lastEntry = prevHistory[prevHistory.length - 1];
            if (lastEntry && lastEntry.text === rule.response && lastEntry.role === 'model') {
              return prevHistory;
            }
            return [...prevHistory, { role: 'model', text: rule.response }];
          });
          setIsLoading(false); // Stop loading as we have a canned response
          return; // Exit function, no need to call API
        }
      }

      // Define the initial instruction that the model should adhere to.
      // This will now be prepended to each user message.
      // ENHANCED INSTRUCTION: More detailed context for tailored responses
      const initialInstruction = `You are an expert AI assistant called Simon, specializing in B2B financial services platform solutions in the UK, with a focus on streamlining payment processing, enhancing regulatory compliance, and providing robust API integrations for corporate clients.
      Your goal is to provide concise, accurate, and helpful information in a friendly manner specifically related to our platform's publicly available product offerings, features, benefits, and common use cases within the UK financial sector.
      Answer only questions relevant to this domain, including pricing structures (general understanding, not specific quotes), core features, service availability, high-level regulatory considerations (e.g., PSD2, Open Banking), and how our platform integrates with existing client systems.
      If a question is outside the scope of B2B financial services or goes into confidential/proprietary details, politely state that you cannot assist with that specific topic and suggest they contact our sales or support team for personalized assistance.\n\n`;

      // Construct the API payload's contents array based on the chat history.
      // The 'user' and 'model' roles are mapped directly.
      const apiContents = chatHistory.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      // For the current user message being sent, prepend the initial instruction.
      // This ensures the model always receives its contextual guidance.
      apiContents.push({
        role: 'user',
        parts: [{ text: initialInstruction + messageContent }]
      });

      const payload = {
        contents: apiContents,
      };

      // API key. For this environment, leave it as an empty string.
      // The Canvas environment will inject the API key securely at runtime.
      const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;

      const apiKey = API_KEY; // Leave as empty string for Canvas environment to inject.
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${response.status} - ${errorData.error.message || response.statusText}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const modelResponseText = result.candidates[0].content.parts[0].text;
        setChatHistory((prevHistory) => [...prevHistory, { role: 'model', text: modelResponseText }]);
      } else {
        console.error("Unexpected API response structure:", result);
        setChatHistory((prevHistory) => [...prevHistory, { role: 'model', text: "Error: Could not parse API response." }]);
      }
    } catch (error) {
      console.error('Failed to send message to Gemini API:', error);
      setChatHistory((prevHistory) => [...prevHistory, { role: 'model', text: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }]);
    } finally {
      setIsLoading(false); // Reset loading state
    }
  };

  /**
   * Handles the Enter key press in the input field.
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      sendMessage();
    }
  };

  // Helper to render message with code block and markdown-style formatting using react-markdown
  const renderMessage = (msg: { role: string; text: string }) => {
    // Simple code block detection (triple backticks)
    const codeBlockRegex = /```([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    // If there are code blocks, split and render accordingly
    while ((match = codeBlockRegex.exec(msg.text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <ReactMarkdown
            key={lastIndex}
            components={markdownComponents}
          >
            {msg.text.slice(lastIndex, match.index)}
          </ReactMarkdown>
        );
      }
      parts.push(
        <pre
          key={match.index}
          className="bg-gray-800 text-green-100 p-3 rounded-xl overflow-x-auto text-sm my-2"
        >
          {match[1]}
        </pre>
      );
      lastIndex = codeBlockRegex.lastIndex;
    }
    if (lastIndex < msg.text.length) {
      parts.push(
        <ReactMarkdown
          key={lastIndex + 1000}
          components={markdownComponents}
        >
          {msg.text.slice(lastIndex)}
        </ReactMarkdown>
      );
    }
    return parts;
  };

  // Custom components for react-markdown to style markdown elements with Tailwind
  const markdownComponents = {
    code({node, inline, className, children, ...props}: any) {
      return !inline ? (
        <pre className="bg-gray-800 text-green-100 p-3 rounded-xl overflow-x-auto text-sm my-2">
          <code {...props}>{children}</code>
        </pre>
      ) : (
        <code className="bg-gray-200 px-1 rounded text-sm">{children}</code>
      );
    },
    blockquote({children, ...props}: any) {
      return (
        <blockquote className="border-l-4 border-blue-400 bg-blue-50 text-blue-900 pl-4 pr-2 py-2 my-2 rounded" {...props}>
          {children}
        </blockquote>
      );
    },
    a({children, href, ...props}: any) {
      return (
        <a
          href={href}
          className="text-blue-600 underline break-all"
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },
    ul({children, ...props}: any) {
      return (
        <ul className="list-disc pl-6 my-2" {...props}>
          {children}
        </ul>
      );
    },
    ol({children, ...props}: any) {
      return (
        <ol className="list-decimal pl-6 my-2" {...props}>
          {children}
        </ol>
      );
    },
    li({children, ...props}: any) {
      return (
        <li className="mb-1" {...props}>
          {children}
        </li>
      );
    },
    strong({children, ...props}: any) {
      return (
        <strong className="font-bold" {...props}>
          {children}
        </strong>
      );
    },
    em({children, ...props}: any) {
      return (
        <em className="italic" {...props}>
          {children}
        </em>
      );
    },
    hr() {
      return <hr className="my-4 border-gray-300" />;
    },
    img({src, alt, ...props}: any) {
      return (
        <img src={src} alt={alt} className="max-w-full rounded my-2" {...props} />
      );
    },
    del({children, ...props}: any) {
      return (
        <del className="line-through" {...props}>
          {children}
        </del>
      );
    },
    h1({children, ...props}: any) {
      return (
        <h1 className="text-2xl font-bold mt-4 mb-2" {...props}>
          {children}
        </h1>
      );
    },
    h2({children, ...props}: any) {
      return (
        <h2 className="text-xl font-bold mt-4 mb-2" {...props}>
          {children}
        </h2>
      );
    },
    h3({children, ...props}: any) {
      return (
        <h3 className="text-lg font-bold mt-4 mb-2" {...props}>
          {children}
        </h3>
      );
    }
  };

  return (
    // Chat container wrapper, now adjusted to fit within a larger layout
    <div className="flex flex-col w-full h-full bg-white rounded-xl shadow-xl overflow-hidden"> {/* Changed rounded-3xl to rounded-xl */}

      {/* Chat header */}
      <div className="bg-gradient-to-r from-blue-700 to-purple-800 text-white p-3 rounded-t-xl shadow-lg flex items-center justify-center relative z-10 flex-shrink-0"> {/* Adjusted p-4 to p-3, rounded-t-3xl to rounded-t-xl */}
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Talk to Simon</h1>
        {/* The close button was already removed based on previous request */}
      </div>

      {/* Chat messages display area */}
      <div className="p-4 space-y-3 bg-gray-100 flex flex-col relative z-0 flex-grow overflow-y-auto rounded-b-xl"> {/* Changed bg-gray-50 to bg-gray-100, added rounded-b-xl */}
        {chatHistory.length === 0 && !isLoading ? ( // Check if chatHistory is truly empty and not just loading
          <div className="flex-1 flex items-center justify-center text-center text-gray-500 italic text-base p-6">
            Start a conversation!
          </div>
        ) : (
          chatHistory.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-xl shadow-sm transition-all duration-300 ease-out whitespace-pre-line text-sm
                  ${msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm' // Rounded-xl and rounded-br-sm for user
                    : 'bg-white text-gray-900 rounded-bl-sm border border-gray-200' // Rounded-xl, rounded-bl-sm, bg-white for model
                  }`}
              >
                {msg.role === 'model' ? renderMessage(msg) : msg.text}
              </div>
            </div>
          ))
        )}
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[70%] p-3 rounded-2xl shadow-sm bg-gray-200 text-gray-600 animate-pulse text-sm">
              Thinking<span className="dot-pulse">.</span><span className="dot-pulse delay-150">.</span><span className="dot-pulse delay-300">.</span>
            </div>
          </div>
        )}
        {/* Scroll ref */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 p-3 bg-blue-800 rounded-b-xl shadow-lg border-t border-blue-700 items-center justify-center"> {/* Adjusted p-4 to p-3, rounded-b-3xl to rounded-b-xl */}
        <input
          type="text"
          className="flex-1 w-full p-2 border border-blue-600 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none transition duration-200 ease-in-out text-base placeholder-gray-500"
          placeholder="Type your message..."
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isLoading}
        />
        <button
          onClick={() => sendMessage()}
          className="w-full sm:w-auto px-5 py-2 bg-blue-600 text-white rounded-lg shadow-lg hover:bg-blue-700 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:ring-opacity-75 transition duration-300 ease-in-out font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed transform"
          disabled={isLoading}
        >
          Send
        </button>
      </div>
    </div>
  );
}

// Main App component for the website layout
function App() {
  // State for accordion visibility
  const [isAccordionChatExpanded, setIsAccordionChatExpanded] = useState(false);
  // State to store the conversation history, now lifted to App.tsx
  const [chatHistory, setChatHistory] = useState<{ role: string; text: string }[]>([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [initialAccordionQuestion, setInitialAccordionQuestion] = useState<string | undefined>(undefined);

  // Effect to add a welcome message to chatHistory when App mounts and history is empty
  // This ensures the welcome message is there even if the chat is not expanded initially
  useEffect(() => {
    if (chatHistory.length === 0) {
      setChatHistory([{
        role: 'model',
        text: "Hello! I'm Simon, your expert AI assistant for B2B financial services. How can I help you today with information on our platform's solutions?"
      }]);
    }
  }, []); // Empty dependency array means this runs only once on mount

  const handleSearchSubmit = () => {
    if (searchQuery.trim() !== '') {
      // When searching, we clear existing chat history and start fresh with the search query
      setChatHistory([
        { role: 'model', text: "Hello! I'm Simon, your expert AI assistant for B2B financial services. How can I help you today with information on our platform's solutions?" },
        { role: 'user', text: searchQuery.trim() }
      ]);
      setInitialAccordionQuestion(searchQuery.trim()); // Set question for accordion
      setIsAccordionChatExpanded(true); // Expand accordion
      setSearchQuery(''); // Clear search query after submitting
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit();
    }
  };

  // Function to toggle accordion chat
  const toggleAccordionChat = () => {
    setIsAccordionChatExpanded(prev => !prev);
    // When toggling, we do NOT clear initialAccordionQuestion
    // If it's already open and being closed, we don't want to trigger a new initial question
    // If it's being opened, it will show the existing history.
  };

  // Function to collapse accordion chat - now just toggles expansion
  const collapseAccordionChat = () => {
    setIsAccordionChatExpanded(false);
    // We do NOT clear initialAccordionQuestion here because we want to retain history.
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans antialiased relative">
      {/* Header/Navbar - Now the container for the accordion chatbot */}
      {/* Added rounded-b-none to header to allow the chatbot's border radius to show when expanded */}
      <header className="bg-gradient-to-r from-blue-900 to-purple-900 text-white p-4 shadow-lg flex flex-col relative z-20 rounded-b-none">
        <nav className="flex items-center justify-between w-full">
          <h1 className="text-2xl font-bold">Portal Pioneers inc</h1>
          <div className="flex items-center space-x-4">
            <ul className="flex space-x-4">
              <li><a href="#" className="hover:text-blue-300 transition-colors">Dashboard</a></li>
              <li><a href="#" className="hover:text-blue-300 transition-colors">Services</a></li>
              <li><a href="#" className="hover:text-blue-300 transition-colors">Reports</a></li>
              <li><a href="#" className="hover:text-blue-300 transition-colors">Settings</a></li>
            </ul>
            {/* Search Field and Button (for accordion behavior) */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Talk to Simon..."
                className="p-2 rounded-full bg-white text-black border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-300 text-sm placeholder-gray-500 w-full sm:w-64 md:w-80"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleSearchKeyPress}
              />
              <button
                onClick={handleSearchSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors font-semibold"
              >
                Search
              </button>
            </div>
            {/* Toggle Accordion Chat button */}
            <button
              onClick={toggleAccordionChat}
              className="ml-4 px-6 py-2 bg-purple-600 text-white rounded-full shadow-lg hover:bg-purple-700 transition-colors font-semibold"
            >
              {isAccordionChatExpanded ? 'Close Chat' : 'Open Chat'}
            </button>
          </div>
        </nav>
        {/* Accordion Chatbot Section - Directly inside the header */}
        {/* The chatbot will now expand *within* the header's visual space */}
        <div
          className={`w-full bg-white rounded-xl shadow-2xl overflow-hidden transition-all duration-700 ease-in-out
            ${isAccordionChatExpanded ? 'max-h-[70vh] mt-4' : 'max-h-0 mt-0 invisible'}`}
          style={{ pointerEvents: isAccordionChatExpanded ? 'auto' : 'none' }}
        >
          {isAccordionChatExpanded && (
            <ChatbotComponent
              initialQuestion={initialAccordionQuestion}
              onClose={collapseAccordionChat}
              chatHistory={chatHistory} // Pass chatHistory prop
              setChatHistory={setChatHistory} // Pass setChatHistory prop
            />
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 text-gray-200 p-4 shadow-xl flex-shrink-0 hidden md:block">
          <h2 className="text-xl font-semibold mb-4">Navigation</h2>
          <ul className="space-y-2">
            <li><a href="#" className="block py-2 px-3 rounded-lg hover:bg-gray-700 transition-colors">Overview</a></li>
            <li><a href="#" className="block py-2 px-3 rounded-lg hover:bg-gray-700 transition-colors">Customers</a></li>
            <li><a href="#" className="block py-2 px-3 rounded-lg hover:bg-gray-700 transition-colors">Products</a></li>
            <li><a href="#" className="block py-2 px-3 rounded-lg hover:bg-gray-700 transition-colors">Support</a></li>
          </ul>
        </aside>

        {/* Content Area for Other Information */}
        <main className="flex-1 p-6 overflow-y-auto">
          <div className="flex-1"> {/* Main content area */}
            <h2 className="text-3xl font-extrabold text-gray-800 mb-6">Financial Dashboard Overview</h2>

            {/* Key Metrics Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Total Assets</h3>
                <p className="text-3xl font-bold text-blue-700">$5.3M</p>
                <p className="text-sm text-gray-500 mt-1">+12% vs last month</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Monthly Revenue</h3>
                <p className="text-3xl font-bold text-green-600">$185K</p>
                <p className="text-sm text-gray-500 mt-1">+8% vs last month</p>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Active Accounts</h3>
                <p className="text-3xl font-bold text-purple-700">1,245</p>
                <p className="text-sm text-gray-500 mt-1">+50 new accounts</p>
              </div>
            </div>

            {/* Recent Transactions Section */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 mb-8">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Recent Transactions</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2025-06-24</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Payment to Global Corp</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">-$5,000.00</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Completed</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2025-06-23</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Deposit from Alpha Solutions</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">+$12,500.00</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Completed</span>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2025-06-22</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Service Fee</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">-$150.00</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Pending</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Market Insights Section */}
            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
              <h3 className="text-2xl font-bold text-gray-800 mb-4">Market Insights</h3>
              <p className="text-gray-700 leading-relaxed mb-4">
                The global financial market continues its volatile trend. Analysts predict a modest recovery in Q3, driven by tech sector growth and stable interest rates. However, geopolitical tensions remain a key risk factor. Companies focusing on digital transformation and robust compliance frameworks are better positioned for sustained growth.
              </p>
              <ul className="list-disc pl-5 text-gray-700 space-y-2">
                <li>Digital payment solutions seeing increased adoption.</li>
                <li>Emphasis on strong AML and KYC compliance.</li>
                <li>API-first integration strategies are becoming standard.</li>
              </ul>
            </div>
          </div>
        </main>
      </div>

      {/* Simple CSS for the loading dots */}
      <style>{`
        .dot-pulse {
          animation: dot-pulse 1s infinite;
          opacity: 0;
          display: inline-block; /* To make dots animate nicely */
        }
        .dot-pulse.delay-150 { animation-delay: 0.15s; }
        .dot-pulse.delay-300 { animation-delay: 0.30s; }

        @keyframes dot-pulse {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default App;