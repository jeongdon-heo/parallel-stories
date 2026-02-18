'use client';

import React, { useState, useEffect } from 'react';
import { Book, Sparkles, Trees, Rocket, Waves, GraduationCap, ChevronRight, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const ROOMS = [
  {
    id: 'forest',
    title: '신비한 숲',
    description: '말을 하는 나무들과 요정들이 사는 비밀의 숲 이야기',
    icon: <Trees size={32} />,
    color: 'bg-green-100 text-green-600',
    borderColor: 'border-green-200',
    hoverColor: 'hover:bg-green-500 hover:text-white',
    bgImage: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'space',
    title: '우주 정거장',
    description: '먼 행성에서 온 외계인 친구와 함께 떠나는 은하계 모험',
    icon: <Rocket size={32} />,
    color: 'bg-blue-100 text-blue-600',
    borderColor: 'border-blue-200',
    hoverColor: 'hover:bg-blue-500 hover:text-white',
    bgImage: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'sea',
    title: '심해 도시',
    description: '바다 깊은 곳, 반짝이는 진주성에서 벌어지는 판타지',
    icon: <Waves size={32} />,
    color: 'bg-cyan-100 text-cyan-600',
    borderColor: 'border-cyan-200',
    hoverColor: 'hover:bg-cyan-500 hover:text-white',
    bgImage: 'https://images.unsplash.com/photo-1518340411843-d4d2999fa291?auto=format&fit=crop&q=80&w=400'
  },
  {
    id: 'school',
    title: '마법 학교',
    description: '빗자루를 타고 수업을 듣는 꼬마 마법사들의 특별한 하루',
    icon: <GraduationCap size={32} />,
    color: 'bg-purple-100 text-purple-600',
    borderColor: 'border-purple-200',
    hoverColor: 'hover:bg-purple-500 hover:text-white',
    bgImage: 'https://images.unsplash.com/photo-1543160732-dd381744ad54?auto=format&fit=crop&q=80&w=400'
  }
];

export default function LobbyPage() {
  const [roomStatuses, setRoomStatuses] = useState<Record<string, { turnCount: number, isFinished: boolean }>>({});

  useEffect(() => {
    const unsubscribes = ROOMS.map(room => {
      return onSnapshot(doc(db, 'projects', room.id), (snapshot) => {
        if (snapshot.exists()) {
          setRoomStatuses(prev => ({
            ...prev,
            [room.id]: snapshot.data() as { turnCount: number, isFinished: boolean }
          }));
        }
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#FDFCF0] p-8 md:p-16 flex flex-col items-center">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/paper-fibers.png")' }}></div>

      <header className="z-10 text-center mb-16">
        <div className="inline-flex p-3 bg-yellow-100 rounded-2xl text-yellow-600 mb-4 shadow-sm">
          <Sparkles size={32} />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-[#5C544B] mb-4 font-serif">우리 반 평행 세계</h1>
        <p className="text-[#8B8378] text-lg max-w-md mx-auto leading-relaxed">
          친구들과 함께 다른 테마의 방으로 떠나보세요!<br />
          어떤 마법 같은 이야기가 여러분을 기다리고 있을까요?
        </p>
      </header>

      <div className="z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 w-full max-w-7xl">
        {ROOMS.map((room) => {
          const status = roomStatuses[room.id];
          return (
            <Link key={room.id} href={`/room/${room.id}`} className="group">
              <div className={`relative h-full bg-white rounded-[2.5rem] p-8 border-2 ${room.borderColor} shadow-xl transform transition-all duration-300 group-hover:-translate-y-4 group-hover:shadow-2xl overflow-hidden`}>
                {/* Room Background Preview (Optional, subtle hover effect) */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-500">
                  <img src={room.bgImage} alt={room.title} className="w-full h-full object-cover" />
                </div>

                <div className={`inline-flex p-4 rounded-3xl ${room.color} mb-6 shadow-sm transition-colors duration-300`}>
                  {room.icon}
                </div>

                <h3 className="text-xl font-bold text-[#4A443D] mb-3">{room.title}</h3>
                <p className="text-sm text-[#8B8378] mb-8 leading-relaxed">
                  {room.description}
                </p>

                <div className="flex items-center justify-between mt-auto">
                  <div className="flex flex-col gap-1">
                    {status ? (
                      <>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${status.isFinished ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-500'}`}>
                          {status.isFinished ? '이야기 완성! 🎉' : `진행 중 (${status.turnCount}/10)`}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-400 rounded-full">대기 중</span>
                    )}
                  </div>
                  <div className={`p-2 rounded-full ${room.color} group-hover:bg-blue-500 group-hover:text-white transition-all`}>
                    <ChevronRight size={20} />
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <footer className="z-10 mt-20 text-center">
        <div className="flex items-center gap-2 text-[#B4AD9F] font-medium text-sm">
          <MessageSquare size={16} />
          <span>모둠별로 하나의 방을 선택해서 입장해주세요!</span>
        </div>
      </footer>
    </div>
  );
}
