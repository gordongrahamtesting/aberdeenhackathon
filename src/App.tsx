import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { cannedResponses, CannedResponseRule } from './cannedResponses'; // Import CannedResponseRule interface

// Chatbot component
function ChatbotComponent({
  onChatOpen,
  initialQuestion,
  onClose,
  chatHistory,
  setChatHistory,
  userName
}: {
  onChatOpen?: () => void;
  initialQuestion?: string;
  onClose?: () => void;
  chatHistory: { role: string; text: string }[];
  setChatHistory: React.Dispatch<React.SetStateAction<{ role: string; text: string }[]>>;
  userName: string;
}) {
  const [userInput, setUserInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const personalizedWelcomeMessage = `Hello ${userName}! I'm Annie, your expert AI assistant for B2B financial services. How can I help you today with information on our platform's solutions?`;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  useEffect(() => {
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
    if (onChatOpen) {
      onChatOpen();
    }
  }, [initialQuestion, onChatOpen, personalizedWelcomeMessage, setChatHistory]);

  interface LocalCannedRule {
    keywords: {
      all?: string[];
      any?: string[];
    };
    response: string;
  }

  const localHiddenPrompts: LocalCannedRule[] = [
    {
      keywords: { any: ["6 months", "past six months", "half year", "last six months", "recent performance", "recent", "short term return"] },
      response: "Your investments have shown a **+8.5% return** over the past 6 months (as of June 26, 2025). This includes a strong performance from your tech sector holdings."
    },
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

      for (const rule of localHiddenPrompts) {
        let matched = false;
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
          return;
        }
      }

      for (const rule of cannedResponses) {
        if (rule.test(messageContent)) {
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      sendMessage();
    }
  };

  const handleCannedQuestionClick = (question: string) => {
    sendMessage(question);
  };

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
          className="bg-gray-100 text-gray-800 p-3 rounded-xl overflow-x-auto text-sm my-2"
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

  const markdownComponents = {
    code({node, inline, className, children, ...props}: any) {
      return !inline ? (
        <pre className="bg-gray-100 text-gray-900 p-3 rounded-md overflow-x-auto text-sm my-2">
          <code {...props}>{children}</code>
        </pre>
      ) : (
        <code className="bg-red-100 text-red-800 px-1 rounded text-sm">{children}</code>
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
          className="text-blue-600 hover:text-blue-800 underline break-all"
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
      return <hr className="my-4 border-gray-200" />;
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
        <h1 className="text-2xl font-bold mt-4 mb-2 text-gray-900" {...props}>
          {children}
        </h1>
      );
    },
    h2({children, ...props}: any) {
      return (
        <h2 className="text-xl font-bold mt-4 mb-2 text-gray-900" {...props}>
          {children}
        </h2>
      );
    },
    h3({children, ...props}: any) {
      return (
        <h3 className="text-lg font-bold mt-4 mb-2 text-gray-900" {...props}>
          {children}
        </h3>
      );
    }
  };

  const isaAllowanceUsedQuery = "How much of my ISA allowance have I used this tax year?";
  const isaAllowanceRemainingQuery = "How much of my ISA allowance is remaining for the current tax year?";
  const esgFundsQuery = "Which of my funds held are ESG funds?";
  const transactionHistoryQuery = `PortalUser1234 Transaction history`;

  const specificAccountPrompts: CannedResponseRule[] = cannedResponses.filter(rule => {
    const isSpecificAccountPrompt = rule.prompt !== undefined && rule.prompt !== null && [
      isaAllowanceUsedQuery,
      isaAllowanceRemainingQuery,
      esgFundsQuery,
      transactionHistoryQuery
    ].includes(rule.prompt);
    return isSpecificAccountPrompt;
  });

  const generalHelpPrompts: CannedResponseRule[] = cannedResponses.filter(rule => {
    const isSpecificAccountPrompt = rule.prompt !== undefined && rule.prompt !== null && [
      isaAllowanceUsedQuery,
      isaAllowanceRemainingQuery,
      esgFundsQuery,
      transactionHistoryQuery
    ].includes(rule.prompt);

    const isFallbackOrGreeting = rule.keywords.alwaysMatch || (rule.keywords.any && rule.keywords.any.some(kw =>
      ["hello", "hi", "hey", "you there", "nice to meet you", "thank you", "thanks", "cheers", "appreciate it", "weather", "recipe", "sports"]
      .includes(kw.toLowerCase())
    ));

    return rule.prompt !== null && rule.prompt !== undefined && !isSpecificAccountPrompt && !isFallbackOrGreeting;
  });

  return (
    <div className="flex flex-col w-full h-full bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200">

      {/* Chat header */}
      <div className="bg-gray-50 p-3 rounded-t-xl shadow-sm flex items-center justify-between relative z-10 border-b border-gray-200">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900">Ask Annie</h1>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors duration-200 focus:outline-none"
            aria-label="Close chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Chat messages display area */}
      <div className="p-4 space-y-3 bg-white text-gray-800 flex flex-col relative z-0 flex-grow overflow-y-auto">
        {chatHistory.length === 0 && !isLoading ? (
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
                    ? 'bg-green-600 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-800 rounded-bl-none border border-gray-200'
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
            <div className="max-w-[70%] p-3 rounded-2xl shadow-sm bg-gray-100 text-gray-500 animate-pulse text-sm">
              Thinking<span className="dot-pulse">.</span><span className="dot-pulse delay-150">.</span><span className="dot-pulse delay-300">.</span>
            </div>
          </div>
        )}
        {/* Scroll ref */}
        <div ref={messagesEndRef} />
      </div>

      {/* Sticky clickable prompts and Input area */}
      <div className="flex flex-col flex-shrink-0 bg-white rounded-b-xl border-t border-gray-200">
        {/* Clickable prompts section */}
        {chatHistory.length > 0 && (
          <div className="flex flex-col p-3 bg-gray-50 border-b border-gray-200">
            {/* Specific Account Prompts */}
            <div className="flex flex-wrap justify-center gap-2 mb-3">
              {specificAccountPrompts.map((rule, promptIndex) => (
                <button
                  key={`specific-prompt-${promptIndex}`}
                  onClick={() => handleCannedQuestionClick(rule.prompt!)}
                  className="bg-green-600 text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:bg-green-700 transition-colors duration-200 ease-in-out cursor-pointer shadow-md"
                >
                  {rule.prompt}
                </button>
              ))}
            </div>

            {/* Separator */}
            {specificAccountPrompts.length > 0 && generalHelpPrompts.length > 0 && (
              <hr className="my-2 border-gray-200" />
            )}

            {/* General Help Prompts */}
            {generalHelpPrompts.length > 0 && (
              <>
                <h3 className="text-gray-700 text-center text-sm font-semibold mb-2 mt-2">More Ways to Help</h3>
                <div className="flex flex-wrap justify-center gap-2">
                  {generalHelpPrompts.map((rule, promptIndex) => (
                    <button
                      key={`general-prompt-${promptIndex}`}
                      onClick={() => handleCannedQuestionClick(rule.prompt!)}
                      className="bg-gray-200 text-gray-800 text-sm font-semibold px-4 py-1.5 rounded-full hover:bg-gray-300 transition-colors duration-200 ease-in-out cursor-pointer shadow-md"
                    >
                      {rule.prompt}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Input area */}
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 p-3 items-center justify-center">
          <input
            type="text"
            className="flex-1 w-full p-2 border border-gray-300 bg-white text-gray-900 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition duration-200 ease-in-out text-base placeholder-gray-500"
            placeholder="Type your message..."
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage()}
            className="w-full sm:w-auto px-5 py-2 bg-green-600 text-white rounded-lg shadow-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 transition duration-300 ease-in-out font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed transform"
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
  const [isChatPanelOpen, setIsChatPanelOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<{ role: string; text: string }[]>([]);
  const [userName] = useState<string>("PortalUser1234"); // Keep PortalUser1234 for consistency with the design's "Good Evening Annie" if Annie is the bot.
  const [initialChatQuestion, setInitialChatQuestion] = useState<string | undefined>(undefined);
  const [activeTab, setActiveTab] = useState('Summary');

  const lastUpdatedDate = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const toggleChatPanel = () => {
    setIsChatPanelOpen(prev => !prev);
  };

  const collapseChatPanel = () => {
    setIsChatPanelOpen(false);
  };

  const personalizedWelcomeMessage = `Hello! I'm Annie, your expert AI assistant for B2B financial services. How can I help you today with information on our platform's solutions?`;

  useEffect(() => {
    if (chatHistory.length === 0 && !initialChatQuestion) {
      setChatHistory([{
        role: 'model',
        text: personalizedWelcomeMessage
      }]);
    }
  }, [personalizedWelcomeMessage, chatHistory.length, initialChatQuestion]);

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-[#F0F2F5]">
      {/* Sidebar */}
      <aside className="w-24 bg-[#1A2A2A] text-gray-300 p-4 flex flex-col items-center justify-between shadow-xl">
        <div className="flex flex-col items-center mb-8">
          <span className="text-white text-2xl font-bold mb-4">⌘</span>
          <span className="text-white text-sm font-semibold tracking-wider">aiPIONEERS</span>
        </div>
        <nav className="flex flex-col space-y-6">
          {['Watch', 'Home', 'Support', 'Documents', 'Income', 'Settings'].map((item) => (
            <a href="#" key={item} className="flex flex-col items-center text-gray-400 hover:text-green-400 transition-colors">
              <div className="w-6 h-6 mb-1 bg-gray-600 rounded-full flex items-center justify-center text-xs">I</div>
              <span className="text-xs">{item}</span>
            </a>
          ))}
        </nav>
        <div></div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-[#F0F2F5] relative">
        <header className="px-16 py-6 bg-white shadow-sm flex items-center justify-between">
          <div className="max-w-7xl mx-auto w-full">
            <div className="flex flex-col">
              <h1 className="text-3xl font-semibold text-gray-900">Good Evening {userName}.</h1>
              <p className="text-xl text-gray-600 mt-1">How can we help you?</p>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 px-16 py-10 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <div className="bg-[#1A2A2A] text-white p-6 rounded-2xl shadow-xl mb-10">
              <h2 className="text-2xl font-semibold mb-4 text-green-400">Your Portfolio</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex flex-col">
                  <span className="text-lg text-gray-400">Portfolio value today</span>
                  <span className="text-4xl font-bold mt-1">£500,050.00</span>
                  <span className="text-sm text-gray-500 mt-1">Last updated {lastUpdatedDate}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg text-gray-400">Change in value</span>
                  <span className="text-4xl font-bold mt-1">£11,000.00</span>
                  <span className="text-sm text-gray-500 mt-1">Past 12 Months</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-lg text-gray-400">Return %</span>
                  <span className="text-4xl font-bold text-green-400 mt-1">+ 4.67%</span>
                  <span className="text-sm text-gray-500 mt-1">Past 12 Months</span>
                </div>
              </div>
            </div>

            <div className="border-b border-gray-200 mb-6">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                {['Summary', 'Investments', 'Performance', 'Insights', 'Transaction History'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`${
                      activeTab === tab
                        ? 'border-green-500 text-green-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-lg focus:outline-none`}
                  >
                    {tab}
                  </button>
                ))}
              </nav>
            </div>

            {activeTab === 'Summary' && (
              <>
                <div className="bg-white p-8 rounded-2xl shadow-md mb-10">
                  <h3 className="text-xl font-semibold mb-6 text-gray-900">Valuation Summary</h3>
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account number</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Change in value<br />Past 12 months</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 flex items-center">
                          <span className="h-2.5 w-2.5 rounded-full bg-green-500 mr-2"></span>ISA
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">WPXXX566-004</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">£500,000.00</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">£11,000.00</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 flex items-center">
                          <span className="h-2.5 w-2.5 rounded-full bg-purple-500 mr-2"></span>Personal Portfolio
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">WPXXX566-004</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">£0</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">£0</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 flex items-center">
                          <span className="h-2.5 w-2.5 rounded-full bg-pink-500 mr-2"></span>Cash Account
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">WPXXX566-004</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">£50.00</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">£4.00</td>
                      </tr>
                      <tr className="bg-gray-50 font-bold">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" colSpan={2}>Portfolio Total</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">£500,050.00</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">£11,004.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h2 className="text-2xl font-semibold text-gray-900 mb-6">Product Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200">
                    <div className="flex items-center mb-4">
                      <span className="h-3 w-3 rounded-full bg-green-500 mr-2"></span>
                      <h4 className="text-lg font-semibold text-gray-900">ISA</h4>
                    </div>
                    <div className="text-gray-700 space-y-2">
                      <p className="flex justify-between"><span>Value today</span> <span className="font-semibold">£500,00.00</span></p>
                      <p className="flex justify-between"><span>Next regular payment in</span> <span className="font-semibold">£500.00</span></p>
                      <p className="flex justify-between"><span>Next regular withdrawal</span> <span className="font-semibold">None</span></p>
                      <p className="flex justify-between"><span>ISA allowance remaining</span> <span className="font-semibold">£7,500.00</span></p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200">
                    <div className="flex items-center mb-4">
                      <span className="h-3 w-3 rounded-full bg-purple-500 mr-2"></span>
                      <h4 className="text-lg font-semibold text-gray-900">Personal Portfolio</h4>
                    </div>
                    <div className="text-gray-700 space-y-2">
                      <p className="flex justify-between"><span>Value today</span> <span className="font-semibold">£0.00</span></p>
                      <p className="flex justify-between"><span>Next regular payment in</span> <span className="font-semibold">None</span></p>
                      <p className="flex justify-between"><span>Next regular withdrawal</span> <span className="font-semibold">None</span></p>
                      <p className="flex justify-between"><span>ISA allowance remaining</span> <span className="font-semibold">None</span></p>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-200">
                    <div className="flex items-center mb-4">
                      <span className="h-3 w-3 rounded-full bg-pink-500 mr-2"></span>
                      <h4 className="text-lg font-semibold text-gray-900">Cash Account</h4>
                    </div>
                    <div className="text-gray-700 space-y-2">
                      <p className="flex justify-between"><span>Value today</span> <span className="font-semibold">£50.00</span></p>
                      <p className="flex justify-between"><span>Next regular payment in</span> <span className="font-semibold">£50.00</span></p>
                      <p className="flex justify-between"><span>Next regular withdrawal</span> <span className="font-semibold">None</span></p>
                      <p className="flex justify-between"><span>ISA allowance remaining</span> <span className="font-semibold">None</span></p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          {/* "Need Help" Button (Fixed position) */}
          <button
            onClick={toggleChatPanel}
            className="fixed bottom-10 right-10 bg-[#4CAF50] text-white px-6 py-3 rounded-full shadow-lg hover:bg-green-600 transition-colors duration-200 ease-in-out flex items-center space-x-2 z-40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9.228a4.5 4.5 0 110 5.656M15.712 18.176l-1.031-.295a6.526 6.526 0 01-4.707-4.707l-.295-1.031m3.656 3.656A4.5 4.5 0 119.228 8.228M12 21a9 9 0 110-18 9 9 0 010 18z" />
            </svg>
            <span>Need Help? Ask me a question</span>
          </button>

        </main>
      </div>

      {/* Chatbot Side Panel - POSITIONED ABSOLUTELY */}
      <div
        className={`fixed right-10 bottom-28 h-2/3 bg-white shadow-2xl overflow-hidden transition-all duration-500 ease-in-out z-50 rounded-xl
          ${isChatPanelOpen ? 'translate-x-0 w-[30rem]' : 'translate-x-full w-0'}`}
      >
        {isChatPanelOpen && (
          <ChatbotComponent
            initialQuestion={initialChatQuestion}
            onClose={collapseChatPanel}
            chatHistory={chatHistory}
            setChatHistory={setChatHistory}
            userName={userName}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="absolute bottom-0 left-0 right-0 w-full bg-[#1A2A2A] text-gray-400 p-6 flex flex-col md:flex-row justify-between items-center text-sm z-10">
        <div className="mb-4 md:mb-0 text-center md:text-left">
          <h3 className="text-white font-semibold text-lg mb-2">⌘ aiPIONEERS</h3>
          <p>Copyright ©PIIONEERS Group plc {new Date().getFullYear()}. All rights reserved.</p>
          <p>Uninvested Deposits, is registered in The World.</p>
        </div>
        <nav className="flex flex-wrap justify-center md:justify-end space-x-4 md:space-x-8">
          <a href="#" className="hover:text-green-400">Cookie policy</a>
          <a href="#" className="hover:text-green-400">Privacy</a>
          <a href="#" className="hover:text-green-400">Legal Information</a>
          <a href="#" className="hover:text-green-400">Accessibility</a>
          <a href="#" className="hover:text-green-400">Modern Slavery Statement</a>
        </nav>
        <div className="mt-4 md:mt-0 text-center md:text-right">
          <ul className="space-y-2">
            <li><a href="#" className="hover:text-green-400">Home</a></li>
            <li><a href="#" className="hover:text-green-400">Status tracker</a></li>
            <li><a href="#" className="hover:text-green-400">Support</a></li>
            <li><a href="#" className="hover:text-green-400">Tech Zone</a></li>
          </ul>
        </div>
      </footer>

      {/* Simple CSS for the loading dots */}
      <style>{`
        .dot-pulse {
          animation: dot-pulse 1s infinite;
          opacity: 0;
          display: inline-block;
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