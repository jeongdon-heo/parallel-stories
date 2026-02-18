'use client';

import React, { useState, useRef, useEffect, use } from 'react';
import { Book, Send, Sparkles, User, MessageCircle, Menu, Loader2, ArrowRight, PartyPopper, Home } from 'lucide-react';
import { storyModel } from '@/lib/gemini';
import { db } from '@/lib/firebase';
import Link from 'next/link';
import {
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp,
    doc,
    setDoc,
    updateDoc,
    increment
} from 'firebase/firestore';

interface Message {
    id: string;
    role: 'user' | 'ai';
    content: string;
    sender: string;
    timestamp: any;
}

interface ProjectData {
    turnCount: number;
    maxTurn: number;
    isFinished: boolean;
}

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
    const { roomId } = use(params);
    const [nickname, setNickname] = useState('');
    const [isEntered, setIsEntered] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [projectData, setProjectData] = useState<ProjectData>({ turnCount: 0, maxTurn: 10, isFinished: false });
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false); // New strict guard for 429 prevention
    const isInitializingRef = useRef(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Load nickname from sessionStorage on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedNickname = sessionStorage.getItem('story_nickname');
            if (savedNickname) {
                setNickname(savedNickname);
                setIsEntered(true);
            }
        }
    }, []);

    // 1. Sync Project Data & Messages
    useEffect(() => {
        if (!isEntered) return;

        // Sync Messages
        const qMessages = query(
            collection(db, 'projects', roomId, 'stories'),
            orderBy('timestamp', 'asc')
        );
        const unsubscribeMessages = onSnapshot(qMessages, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Message[];
            setMessages(msgs);

            // Initialize if empty - Strict Guard
            if (msgs.length === 0 && !isInitializingRef.current && !isProcessing) {
                initializeStoryIfEmpty();
            }
        });

        // Sync Project State
        const unsubscribeProject = onSnapshot(doc(db, 'projects', roomId), (snapshot) => {
            if (snapshot.exists()) {
                setProjectData(snapshot.data() as ProjectData);
            } else {
                // Initialize project doc if missing
                setDoc(doc(db, 'projects', roomId), {
                    turnCount: 0,
                    maxTurn: 10,
                    isFinished: false
                });
            }
        });

        return () => {
            unsubscribeMessages();
            unsubscribeProject();
        };
    }, [isEntered, roomId]);

    const initializeStoryIfEmpty = async () => {
        if (isInitializingRef.current || isProcessing) return;
        isInitializingRef.current = true;
        setIsProcessing(true);
        setIsLoading(true);
        try {
            console.log(`${roomId} 이야기가 비어있어 첫 문장을 생성합니다...`);
            const themes: Record<string, string> = {
                forest: "신비한 숲",
                space: "우주 정거장",
                sea: "심해 도시",
                school: "마법 학교"
            };
            const currentTheme = themes[roomId] || "모험";

            const prompt = `초등학교 4학년 수준의 흥미진진한 '${currentTheme}' 테마의 모험 판타지 소설 도입부를 딱 한 문장으로 써줘. 말투는 '~했답니다'와 같은 동화체로 하고, 질문은 하지 마.`;
            const result = await storyModel.generateContent(prompt);
            const aiText = result.response.text();

            await addDoc(collection(db, 'projects', roomId, 'stories'), {
                role: 'ai',
                content: aiText,
                sender: 'AI 작가님',
                timestamp: serverTimestamp(),
            });
        } catch (error) {
            console.error('Initialization Error:', error);
            // On error, allow retry after some time
            setTimeout(() => { isInitializingRef.current = false; }, 30000);
        } finally {
            setIsProcessing(false);
            setIsLoading(false);
        }
    };

    const handleSend = async () => {
        if (!inputValue.trim() || isProcessing || projectData.isFinished) return;

        const currentInput = inputValue;
        setInputValue('');
        setIsProcessing(true);
        setIsLoading(true);

        try {
            const projectRef = doc(db, 'projects', roomId);

            // 1. Save User Message & Increment Turn
            await addDoc(collection(db, 'projects', roomId, 'stories'), {
                role: 'user',
                content: currentInput,
                sender: nickname,
                timestamp: serverTimestamp(),
            });
            await updateDoc(projectRef, { turnCount: increment(1) });

            // 2. Prepare history for Gemini
            const rawHistory = messages.map(msg => ({
                role: msg.role === 'ai' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            }));
            const firstUserIndex = rawHistory.findIndex(msg => msg.role === 'user');
            const history = firstUserIndex !== -1 ? rawHistory.slice(firstUserIndex) : [];

            // 3. AI Turn - with ending logic
            const isLastTurn = projectData.turnCount + 1 >= projectData.maxTurn;
            const chatSession = storyModel.startChat({ history });

            let finalPrompt = currentInput;
            if (isLastTurn) {
                finalPrompt += "\n(참고: 이제 마지막 턴입니다. 지금까지의 내용을 바탕으로 이야기를 훈훈한 교훈이나 여운과 함께 마무리 지어주세요.)";
            }

            const result = await chatSession.sendMessage(finalPrompt);
            const aiText = (await result.response).text();

            // 4. Save AI Response
            await addDoc(collection(db, 'projects', roomId, 'stories'), {
                role: 'ai',
                content: aiText,
                sender: 'AI 작가님',
                timestamp: serverTimestamp(),
            });

            if (isLastTurn) {
                await updateDoc(projectRef, { isFinished: true });
            }

        } catch (error) {
            console.error('Relay Mode Error:', error);
            // If it's a 429, we might want to alert the user or just log it
        } finally {
            setIsProcessing(false);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const handleEnter = (e: React.FormEvent) => {
        e.preventDefault();
        if (nickname.trim()) {
            sessionStorage.setItem('story_nickname', nickname.trim());
            setIsEntered(true);
        }
    };

    if (!isEntered) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm p-4">
                <div className="w-full max-w-md p-8 bg-white rounded-3xl shadow-2xl border border-[#F0E6D2] text-center animate-in fade-in zoom-in duration-300">
                    <div className="mb-6 inline-flex p-4 bg-blue-50 rounded-full text-blue-600">
                        <User size={40} />
                    </div>
                    <h2 className="text-xl font-bold text-[#5C544B] mb-2">어떤 이름을 쓸까요?</h2>
                    <p className="text-[#8B8378] mb-8 text-sm">친구들이 알아볼 수 있게 멋진 이름을 써줘!</p>
                    <form onSubmit={handleEnter} className="space-y-4">
                        <input
                            type="text"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="이름을 입력해주세요"
                            className="w-full px-6 py-4 bg-[#F9F7F2] border-2 border-[#E5E1D1] rounded-2xl outline-none focus:border-blue-400 transition-colors text-center font-bold text-[#4A443D]"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={!nickname.trim()}
                            className="w-full bg-blue-500 text-white font-bold py-4 rounded-2xl hover:bg-blue-600 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 disabled:bg-gray-300"
                        >
                            입장하기 <ArrowRight size={20} />
                        </button>
                        <Link href="/" className="block text-sm text-[#8B8378] hover:text-blue-500 underline mt-4">
                            대기실로 돌아가기
                        </Link>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-[#FDFCF0]">
            {/* Left Area: Storybook */}
            <div className="relative flex w-1/2 flex-col items-center justify-center p-12 shadow-inner bg-[#F5F1E1] border-r border-[#E5E1D1]">
                <div className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/paper-fibers.png")' }}></div>

                <div className="z-10 w-full max-w-lg mb-8 text-center text-[#5C544B]">
                    <h1 className="text-3xl font-bold font-serif mb-4 flex items-center justify-center gap-2">
                        📖 함께 쓰는 릴레이 동화
                        {projectData.isFinished && <PartyPopper className="text-yellow-500 animate-bounce" />}
                    </h1>

                    <div className="flex flex-col items-center gap-2 mb-4">
                        <div className="w-full max-w-xs bg-[#E5E1D1] h-3 rounded-full overflow-hidden shadow-inner flex">
                            <div className={`h-full transition-all duration-700 ease-out ${projectData.isFinished ? 'bg-green-500' : 'bg-blue-400'}`}
                                style={{ width: `${Math.min((projectData.turnCount / projectData.maxTurn) * 100, 100)}%` }}></div>
                        </div>
                        <p className="text-xs font-bold text-[#8B8378]">
                            {projectData.isFinished ? '이야기 완성! 🎉' : `이야기 진행 상황: ${projectData.turnCount} / ${projectData.maxTurn} 턴`}
                        </p>
                    </div>
                </div>

                <div className="z-10 flex flex-col w-full max-w-2xl aspect-[3/4] bg-white rounded-lg shadow-xl p-10 border border-[#EBE7D5] overflow-y-auto custom-scrollbar">
                    <div className="space-y-6 text-xl text-[#4A443D] leading-relaxed font-serif">
                        {messages.length === 0 ? (
                            <div className="text-center py-20 italic text-[#8B8378]">새로운 이야기가 곧 시작됩니다...</div>
                        ) : (
                            messages.map((msg) => (
                                <p key={msg.id} className={msg.role === 'ai' ? 'text-[#2D3748]' : ''}>
                                    {msg.content}
                                </p>
                            ))
                        )}
                        {projectData.isFinished && (
                            <div className="mt-12 p-8 bg-green-50 rounded-2xl border-2 border-dashed border-green-200 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <PartyPopper className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                                <p className="text-green-700 font-bold text-lg">✨ 축하합니다! 동화가 완성되었어요! ✨</p>
                                <p className="text-green-600 text-sm mt-2">우리가 함께 만든 멋진 평행 세계 이야기에요.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Right Area: Chat & Tools */}
            <div className="flex w-1/2 flex-col bg-white shadow-2xl">
                <header className="flex items-center justify-between px-6 py-4 border-b border-[#F0E6D2] bg-[#FFFBEB]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-xl text-blue-500 shadow-sm"><MessageCircle size={24} /></div>
                        <div>
                            <span className="block font-bold text-[#5C544B] text-sm leading-tight">우리 반 대화창</span>
                            <span className="text-[11px] text-blue-500 font-medium">{nickname}님 참여 중</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Link href="/" title="로비로 가기" className="p-2 text-[#8B8378] hover:bg-[#FDFCF0] rounded-full transition-colors">
                            <Home size={20} />
                        </Link>
                    </div>
                </header>

                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F9F7F2]">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? (msg.sender === nickname ? 'justify-end' : 'justify-start') : 'justify-start'}`}>
                            <div className={`flex max-w-[85%] gap-2 ${msg.role === 'user' && msg.sender === nickname ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm text-[10px] font-bold ${msg.role === 'ai' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-500'}`}>
                                    {msg.role === 'ai' ? <Sparkles size={16} /> : msg.sender[0]}
                                </div>
                                <div>
                                    <div className={`text-[10px] mb-1 text-[#8B8378] ${msg.role === 'user' && msg.sender === nickname ? 'text-right' : 'text-left'}`}>{msg.sender}</div>
                                    <div className={`p-3 rounded-2xl shadow-sm text-sm leading-relaxed ${msg.role === 'user' && msg.sender === nickname ? 'bg-blue-500 text-white rounded-tr-none' : 'bg-white text-[#4A443D] border border-[#F0E6D2] rounded-tl-none'}`}>
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                    {isLoading && !projectData.isFinished && (
                        <div className="flex gap-2 p-4 italic text-sm text-[#8B8378] animate-pulse">
                            <Loader2 size={16} className="animate-spin" /> AI 작가님이 이야기를 잇고 있어요...
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-[#F0E6D2] bg-[#FFFBEB]">
                    {projectData.isFinished ? (
                        <div className="bg-white border-2 border-green-200 rounded-2xl p-6 text-center shadow-lg animate-in fade-in zoom-in duration-500">
                            <PartyPopper className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
                            <p className="font-bold text-[#4A443D]">이야기가 멋지게 완성되었습니다!</p>
                            <p className="text-xs text-[#8B8378] mt-1">여러분 모두 훌륭한 동화 작가님들이에요. ✨</p>
                            <Link href="/" className="inline-block mt-4 bg-blue-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-600 transition-all">
                                다른 방 구경가기
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="relative flex items-center gap-2 bg-white rounded-2xl border border-[#D4CDB7] p-2 pr-3 shadow-md focus-within:ring-2 focus-within:ring-blue-200 transition-all">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                    placeholder={isProcessing ? "작가님이 답장 중이에요..." : "함께 이야기를 이어가요..."}
                                    disabled={isProcessing}
                                    className="flex-1 bg-transparent px-4 py-3 outline-none text-[#4A443D] placeholder-[#B4AD9F] disabled:opacity-50 font-medium"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={isProcessing || !inputValue.trim()}
                                    className="p-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 active:scale-95 transition-all shadow-md flex items-center justify-center disabled:bg-gray-300 disabled:scale-100"
                                >
                                    {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                </button>
                            </div>
                            <p className="mt-3 text-center text-[11px] text-[#B4AD9F] font-medium">친구들과 교대로 문장을 완성해보세요! ({projectData.turnCount}/{projectData.maxTurn})</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
