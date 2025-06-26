import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { cannedResponses, CannedResponseRule } from './cannedResponses'; // Import CannedResponseRule interface

// Chatbot component - now designed to be embedded or pop-out
// It now also accepts an 'onClose' prop to allow the parent to collapse it.
// chatHistory and setChatHistory are now passed as props
function ChatbotComponent({
  onChatOpen,
  initialQuestion,
  onClose,
  chatHistory, // Received as prop
  setChatHistory, // Received as prop
  userName // New prop for personalized greeting
}: {
  onChatOpen?: () => void;
  initialQuestion?: string;
  onClose?: () => void;
  chatHistory: { role: string; text: string }[]; // Type for chatHistory prop
  setChatHistory: React.Dispatch<React.SetStateAction<{ role: string; text: string }[]>>; // Type for setChatHistory prop
  userName: string; // Type for userName prop
}) {
  // State to store the user's current input in the text field
  const [userInput, setUserInput] = useState<string>('');
  // State to manage the loading status (e.g., when waiting for API response)
  const [isLoading, setIsLoading] = useState<boolean>(false);
  // Ref to automatically scroll to the bottom of the chat window
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Construct personalized welcome message
  const personalizedWelcomeMessage = `Hello ${userName}! I'm Annie, your expert AI assistant for B2B financial services. How can I help you today with information on our platform's solutions?`;


  // Effect to scroll to the latest message whenever chatHistory updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  // Effect to add a welcome message or process initial question when the component mounts or initialQuestion changes
  useEffect(() => {
    // If an initial question is provided, always start a new conversation with it
    if (initialQuestion) {
      setChatHistory([
        { role: 'model', text: personalizedWelcomeMessage },
        { role: 'user', text: initialQuestion }
      ]);
      const timer = setTimeout(() => {
        sendMessage(initialQuestion);
      }, 100);
      return () => clearTimeout(timer);
    }
    // Call onChatOpen if provided
    if (onChatOpen) {
      onChatOpen();
    }
  }, [initialQuestion, onChatOpen, personalizedWelcomeMessage]);


  // Define a simple interface for local rules that only need keywords and a response
  interface LocalCannedRule {
    keywords: {
      all?: string[]; // All these keywords must be present
      any?: string[]; // At least one of these keywords must be present
    };
    response: string;
  }

  // --- NEW: Define your text-only prompts with more lenient keyword sets ---
  const localHiddenPrompts: LocalCannedRule[] = [
    // **Option 1: Specificity for "6 Months" - Prioritize the most direct matches**
    // This rule should fire ONLY when "6 months" (or similar short-term phrases) is present.
    {
      keywords: { any: ["6 months", "past six months", "half year", "last six months", "recent performance", "recent", "short term return"] },
      response: "Your investments have shown a **+8.5% return** over the past 6 months (as of June 26, 2025). This includes a strong performance from your tech sector holdings."
    },
    // **Option 2: Specificity for "Inception" - Broader, but less likely to conflict with short terms**
    // This rule fires for general performance, especially when "inception" or similar long-term words are used.
    {
      keywords: { any: ["investments", "investment", "inception", "performed", "performance", "return", "since", "initial", "original investment", "start date", "commencement", "from start", "since day one", "total return", "overall return", "portfolio return"] },
      response: "Since inception (your initial investment date of January 15, 2020), your overall portfolio has achieved a **+27.3% return**."
    },
    {
      keywords: { any: ["fund charge", "percentage", "aggregated", "fees", "cost"] },
      response: "Your current aggregated fund charge percentage across all your holdings is **0.75%** per annum. This includes all management fees and operational costs."
    },
    {
      keywords: { any: ["subscription to isa", "subscription", "new", "top up", "pay into", "add money"] },
      response: "Yes, you can make a new subscription to your ISA. You have **£5,000** remaining of your **£20,000** allowance for the current tax year (which ends April 5, 2026). You can initiate a new subscription via the 'Investments' section of your online portal."
    }
  ];
  // --- END NEW: Define your text-only prompts ---


  /**
   * Handles sending a message to the Gemini API.
   * Updates chat history, calls the API, and processes the response.
   */
  const sendMessage = async (questionToSend?: string) => {
    const messageContent = questionToSend || userInput.trim();
    if (messageContent === '' || isLoading) {
      return;
    }

    if (!questionToSend) {
      setChatHistory((prevHistory) => [...prevHistory, { role: 'user', text: messageContent }]);
      setUserInput('');
    }
    setIsLoading(true);

    try {
      const lowerMessageContent = messageContent.toLowerCase();

      // --- NEW: Check against local hidden prompts first using loosened keyword logic ---
      for (const rule of localHiddenPrompts) {
        let matched = false;

        // Check if ANY of the 'all' keywords are present (loosened from ALL)
        if (rule.keywords.all && rule.keywords.all.length > 0) {
          matched = rule.keywords.all.some(keyword => lowerMessageContent.includes(keyword.toLowerCase()));
        }

        // If 'all' didn't match or wasn't specified, or if any 'all' keyword was found,
        // then check if ANY of the 'any' keywords are present.
        // The condition for 'any' matching should be independent or additive.
        // For 'quite loose', we can just check if ANY keyword from EITHER array is present.
        if (!matched && rule.keywords.any && rule.keywords.any.length > 0) {
          matched = rule.keywords.any.some(keyword => lowerMessageContent.includes(keyword.toLowerCase()));
        }

        // To make it truly "quite loose" and combine 'all' and 'any' into a single 'any' check for local prompts:
        const combinedKeywords = [...(rule.keywords.all || []), ...(rule.keywords.any || [])];
        matched = combinedKeywords.some(keyword => lowerMessageContent.includes(keyword.toLowerCase()));


        if (matched) {
          setChatHistory((prevHistory) => {
            const lastEntry = prevHistory[prevHistory.length - 1];
            if (lastEntry && lastEntry.text === rule.response && lastEntry.role === 'model') {
              return prevHistory;
            }
            return [...prevHistory, { role: 'model', text: rule.response }];
          });
          setIsLoading(false);
          return; // Stop here if a local hidden prompt matches
        }
      }
      // --- END NEW CHECK ---

      // Original: Loop through cannedResponses (from external file)
      for (const rule of cannedResponses) {
        if (rule.test(messageContent)) { // `rule.test` already handles its own keyword logic
          setChatHistory((prevHistory) => {
            const lastEntry = prevHistory[prevHistory.length - 1];
            if (lastEntry && lastEntry.text === rule.response && lastEntry.role === 'model') {
              return prevHistory;
            }
            return [...prevHistory, { role: 'model', text: rule.response }];
          });
          setIsLoading(false);
          return;
        }
      }

      const initialInstruction = `You are an expert AI assistant called Annie, specializing in B2B financial services platform solutions in the UK, with a focus on streamlining payment processing, enhancing regulatory compliance, and providing robust API integrations for corporate clients.
      Your goal is to provide concise, accurate, and helpful information in a friendly manner specifically related to our platform's publicly available product offerings, features, benefits, and common use cases within the UK financial sector.
      Answer only questions relevant to this domain, including pricing structures (general understanding, not specific quotes), core features, service availability, high-level regulatory considerations (e.g., PSD2, Open Banking), and how our platform integrates with existing client systems.
      If a question is outside the scope of your canned responses and general information aroundB2B financial services or goes into confidential/proprietary details, politely state that you cannot assist with that specific topic and suggest they contact our sales or support team for personalized assistance.\n\n`;

      const apiContents = chatHistory.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));

      apiContents.push({
        role: 'user',
        parts: [{ text: initialInstruction + messageContent }]
      });

      const payload = {
        contents: apiContents,
      };

      const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
      const apiKey = API_KEY;
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
      setIsLoading(false);
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

  /**
   * Handles click on a canned question prompt.
   * Sends the canned question as a user message.
   */
  const handleCannedQuestionClick = (question: string) => {
    sendMessage(question);
  };

  // Helper to render message with code block and markdown-style formatting using react-markdown
  const renderMessage = (msg: { role: string; text: string }) => {
    const codeBlockRegex = /```([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

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
          className="bg-neutral-700 text-green-100 p-3 rounded-xl overflow-x-auto text-sm my-2" // Dark grey for code block
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
        <pre className="bg-neutral-700 text-green-100 p-3 rounded-xl overflow-x-auto text-sm my-2">
          <code {...props}>{children}</code>
        </pre>
      ) : (
        <code className="bg-neutral-200 px-1 rounded text-sm">{children}</code>
      );
    },
    blockquote({children, ...props}: any) {
      return (
        <blockquote className="border-l-4 border-gray-400 bg-gray-50 text-gray-900 pl-4 pr-2 py-2 my-2 rounded" {...props}>
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
      return <hr className="my-4 border-neutral-300" />;
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

  // Define the exact question strings to identify the specific prompts
  // Note: These are now used only for filtering *displayed* prompts,
  // not for the text-only ones handled by localHiddenPrompts.
  const isaAllowanceUsedQuery = "How much of my ISA allowance have I used this tax year?";
  const isaAllowanceRemainingQuery = "How much of my ISA allowance is remaining for the current tax year?";
  const esgFundsQuery = "Which of my funds held are ESG funds?";
  const transactionHistoryQuery = `PortalUser1234 Transaction history`;


  // Filter canned responses into two groups for DISPLAYED prompts
  const specificAccountPrompts: CannedResponseRule[] = cannedResponses.filter(rule => {
    // Check if rule.prompt exists and is one of the specific queries
    const isSpecificAccountPrompt = rule.prompt !== undefined && rule.prompt !== null && [
      isaAllowanceUsedQuery,
      isaAllowanceRemainingQuery,
      esgFundsQuery,
      transactionHistoryQuery
    ].includes(rule.prompt);
    return isSpecificAccountPrompt;
  });

  const generalHelpPrompts: CannedResponseRule[] = cannedResponses.filter(rule => {
    // Exclude specific account prompts
    const isSpecificAccountPrompt = rule.prompt !== undefined && rule.prompt !== null && [
      isaAllowanceUsedQuery,
      isaAllowanceRemainingQuery,
      esgFundsQuery,
      transactionHistoryQuery
    ].includes(rule.prompt);

    // Also exclude prompts that are typically not useful as clickable buttons (greetings, fallback, refusals)
    // and rules that might not have 'any' keywords defined if that's how they are suppressed.
    const isFallbackOrGreeting = rule.keywords.alwaysMatch || (rule.keywords.any && rule.keywords.any.some(kw =>
      ["hello", "hi", "hey", "you there", "nice to meet you", "thank you", "thanks", "cheers", "appreciate it", "weather", "recipe", "sports"]
      .includes(kw.toLowerCase())
    ));

    // Ensure rule.prompt exists and is not specific and not a fallback/greeting
    return rule.prompt !== null && rule.prompt !== undefined && !isSpecificAccountPrompt && !isFallbackOrGreeting;
  });

  return (
    // Chat container wrapper
    <div className="flex flex-col w-full h-full bg-white rounded-xl shadow-xl overflow-hidden border border-neutral-300"> {/* White background, subtle border */}

      {/* Chat header */}
      <div className="bg-neutral-950 text-white p-3 rounded-t-xl shadow-lg flex items-center justify-center relative z-10 flex-shrink-0 border-b border-neutral-700">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">Ask Annie</h1>
      </div>

      {/* Chat messages display area */}
      <div className="p-4 py-20 space-y-3 bg-white text-gray-900 flex flex-col relative z-0 flex-grow overflow-y-auto"> {/* White background, dark text */}
        {chatHistory.length === 0 && !isLoading ? (
          <div className="flex-1 flex items-center justify-center text-center text-neutral-500 italic text-base p-6">
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
                    ? 'bg-blue-600 text-white rounded-br-sm' // User message: Retain a distinguishing blue
                    : 'bg-neutral-100 text-gray-900 rounded-bl-sm border border-neutral-200' // Annie's message: Very light grey background, dark text, subtle border
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
            <div className="max-w-[70%] p-3 rounded-2xl shadow-sm bg-neutral-100 text-neutral-600 animate-pulse text-sm">
              Thinking<span className="dot-pulse">.</span><span className="dot-pulse delay-150">.</span><span className="dot-pulse delay-300">.</span>
            </div>
          </div>
        )}
        {/* Scroll ref */}
        <div ref={messagesEndRef} />
      </div>

      {/* Sticky clickable prompts and Input area: Dark footer background */}
      <div className="flex flex-col flex-shrink-0 bg-neutral-950 rounded-b-xl shadow-lg border-t border-neutral-700">
        {/* Clickable prompts section: Dark grey background, subtle border */}
        {chatHistory.length > 0 && (
          <div className="flex flex-col p-3 bg-neutral-800 border-b border-neutral-700">
            {/* Specific Account Prompts */}
            <div className="flex flex-wrap justify-center gap-2 mb-3">
              {specificAccountPrompts.map((rule, promptIndex) => (
                <button
                  key={`specific-prompt-${promptIndex}`}
                  onClick={() => handleCannedQuestionClick(rule.prompt!)}
                  className="bg-blue-700 text-white text-base font-semibold px-5 py-2 rounded-full hover:bg-blue-600 transition-colors duration-200 ease-in-out cursor-pointer shadow-md"
                >
                  {rule.prompt}
                </button>
              ))}
            </div>

            {/* Separator */}
            {specificAccountPrompts.length > 0 && generalHelpPrompts.length > 0 && (
              <hr className="my-2 border-neutral-700" />
            )}

            {/* General Help Prompts */}
            {generalHelpPrompts.length > 0 && (
              <>
                <h3 className="text-neutral-300 text-center text-sm font-semibold mb-2 mt-2">More Ways to Help</h3>
                <div className="flex flex-wrap justify-center gap-2">
                  {generalHelpPrompts.map((rule, promptIndex) => (
                    <button
                      key={`general-prompt-${promptIndex}`}
                      onClick={() => handleCannedQuestionClick(rule.prompt!)}
                      className="bg-neutral-700 text-white text-base font-semibold px-5 py-2 rounded-full hover:bg-neutral-600 transition-colors duration-200 ease-in-out cursor-pointer shadow-md"
                    >
                      {rule.prompt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Input area: Dark background for input container */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 p-3 items-center justify-center">
          <input
            type="text"
            className="flex-1 w-full p-2 border border-neutral-700 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-neutral-600 focus:border-neutral-500 outline-none transition duration-200 ease-in-out text-base placeholder-neutral-400" // Input field itself is white background, dark text
            placeholder="Type your message..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage()}
            className="w-full sm:w-auto px-5 py-2 bg-white text-black rounded-lg shadow-lg hover:bg-white hover:scale-105 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-opacity-75 transition duration-300 ease-in-out font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed transform"
            disabled={isLoading}
          >
            Send
          </button>
        </div>
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
  // Pseudo-login state for the user's name
  const [userName, setUserName] = useState<string>("PortalUser1234");

  const [searchQuery, setSearchQuery] = useState('');
  const [initialAccordionQuestion, setInitialAccordionQuestion] = useState<string | undefined>(undefined);

  // Construct personalized welcome message based on userName
  const personalizedWelcomeMessage = `Hello ${userName}! I'm Annie, your expert AI assistant for B2B financial services. How can I help you today with information on our platform's solutions?`;

  // Effect to add a welcome message to chatHistory when App mounts and history is empty
  useEffect(() => {
    if (chatHistory.length === 0) {
      setChatHistory([{
        role: 'model',
        text: personalizedWelcomeMessage
      }]);
    }
  }, [personalizedWelcomeMessage, chatHistory.length]);

  const handleSearchSubmit = () => {
    if (searchQuery.trim() !== '') {
      setChatHistory([
        { role: 'model', text: personalizedWelcomeMessage },
        { role: 'user', text: searchQuery.trim() }
      ]);
      setInitialAccordionQuestion(searchQuery.trim());
      setIsAccordionChatExpanded(true);
      setSearchQuery('');
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
  };

  // Function to collapse accordion chat - now just toggles expansion
  const collapseAccordionChat = () => {
    setIsAccordionChatExpanded(false);
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans antialiased relative"> {/* Overall white background */}
      {/* Header/Navbar */}
      <header className="bg-neutral-950 text-white p-4 shadow-lg flex flex-col relative z-20 rounded-b-none border-b border-neutral-700"> {/* Deep black */}
        <nav className="flex items-center justify-between w-full">
          <h1 className="text-2xl font-bold text-white">Portal Pioneers inc</h1> {/* White text */}
          <div className="flex items-center space-x-4">
            {/* Display logged-in user name */}
            <span className="font-semibold text-neutral-300">Welcome, {userName}!</span> {/* Lighter grey for welcome */}
            {/* Search Field and Button (for accordion behavior) */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                placeholder="Ask Annie..."
                className="p-2 rounded-full bg-white text-gray-900 border border-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-600 text-sm placeholder-gray-500 w-full sm:w-64 md:w-80" // Changed bg-neutral-800 to bg-white, text-white to text-gray-900, placeholder-neutral-400 to placeholder-gray-500
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleSearchKeyPress}
              />
              <button
                onClick={handleSearchSubmit}
                className="px-4 py-2 bg-neutral-700 text-white rounded-full shadow-lg hover:bg-neutral-600 transition-colors font-semibold"
              >
                Search
              </button>
            </div>
            {/* Toggle Accordion Chat button */}
            <button
              onClick={toggleAccordionChat}
              className="ml-4 px-6 py-2 bg-neutral-700 text-white rounded-full shadow-lg hover:bg-neutral-600 transition-colors font-semibold"
            >
              {isAccordionChatExpanded ? 'Close Chat' : 'Open Chat'}
            </button>
          </div>
        </nav>
        {/* Accordion Chatbot Section */}
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
              userName={userName} // Pass userName prop
            />
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-neutral-900 text-neutral-300 p-4 shadow-xl flex-shrink-0 hidden md:block border-r border-neutral-800"> {/* Dark sidebar, lighter text */}
          <h2 className="text-xl font-semibold mb-4 text-white">Navigation</h2>
          <ul className="space-y-2">
            <li><a href="#" className="block py-2 px-3 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-300">Overview</a></li>
            <li><a href="#" className="block py-2 px-3 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-300">Customers</a></li>
            <li><a href="#" className="block py-2 px-3 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-300">Products</a></li>
            <li><a href="#" className="block py-2 px-3 rounded-lg hover:bg-neutral-800 transition-colors text-neutral-300">Support</a></li>
          </ul>
        </aside>

        {/* Content Area for Other Information */}
        <main className="flex-1 p-6 overflow-y-auto bg-white text-gray-900"> {/* White background for main content */}
          <div className="flex-1"> {/* Main content area */}
            <h2 className="text-3xl font-extrabold text-gray-900 mb-6">Financial Dashboard Overview</h2> {/* Dark text */}

            {/* Key Metrics Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-100 p-6 rounded-2xl shadow-lg border border-gray-200 text-gray-800"> {/* Light grey cards */}
                <h3 className="text-lg font-semibold mb-2 text-gray-900">Total Assets</h3>
                <p className="text-3xl font-bold text-blue-700">$5.3M</p> {/* Retain blue for key data */}
                <p className="text-sm text-gray-600 mt-1">+12% vs last month</p>
              </div>
              <div className="bg-gray-100 p-6 rounded-2xl shadow-lg border border-gray-200 text-gray-800">
                <h3 className="text-lg font-semibold mb-2 text-gray-900">Monthly Revenue</h3>
                <p className="text-3xl font-bold text-green-700">$185K</p> {/* Retain green for positive data */}
                <p className="text-sm text-gray-600 mt-1">+8% vs last month</p>
              </div>
              <div className="bg-gray-100 p-6 rounded-2xl shadow-lg border border-gray-200 text-gray-800">
                <h3 className="text-lg font-semibold mb-2 text-gray-900">Active Accounts</h3>
                <p className="text-3xl font-bold text-purple-700">1,245</p> {/* Retain purple */}
                <p className="text-sm text-gray-600 mt-1">+50 new accounts</p>
              </div>
            </div>

            {/* Recent Transactions Section */}
            <div className="bg-gray-100 p-6 rounded-2xl shadow-lg border border-gray-200 mb-8 text-gray-800">
              <h3 className="text-2xl font-bold mb-4 text-gray-900">Recent Transactions</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-300"> {/* Lighter table dividers */}
                  <thead className="bg-gray-200"> {/* Lighter table header */}
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Date</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Description</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Amount</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200"> {/* White table body */}
                    <tr>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">2025-06-24</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Payment to Global Corp</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">-$5,000.00</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">Completed</span> {/* Status badges remain */}
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
            <div className="bg-gray-100 p-6 rounded-2xl shadow-lg border border-gray-200 text-gray-800">
              <h3 className="text-2xl font-bold mb-4 text-gray-900">Market Insights</h3>
              <p className="leading-relaxed mb-4">
                The global financial market continues its volatile trend. Analysts predict a modest recovery in Q3, driven by tech sector growth and stable interest rates. However, geopolitical tensions remain a key risk factor. Companies focusing on digital transformation and robust compliance frameworks are better positioned for sustained growth.
              </p>
              <ul className="list-disc pl-5 space-y-2">
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