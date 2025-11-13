window.emotions = [
    { id: "joy",        label: "기쁨",    tone: "bg-yellow-200 hover:bg-yellow-300 text-gray-900" },
    { id: "sadness",    label: "슬픔",    tone: "bg-blue-200 hover:bg-blue-300 text-gray-900" },
    { id: "depression", label: "우울",    tone: "bg-gray-200 hover:bg-gray-300 text-gray-900" },
    { id: "excitement", label: "설렘",    tone: "bg-purple-200 hover:bg-purple-300 text-gray-900" },
    { id: "peace",      label: "평온",    tone: "bg-teal-200 hover:bg-teal-300 text-gray-900" },
    { id: "anger",      label: "화남",    tone: "bg-red-200 hover:bg-red-300 text-gray-900" },
    { id: "happiness",  label: "행복",    tone: "bg-orange-200 hover:bg-orange-300 text-gray-900" },
    { id: "other",      label: "기타",    tone: "bg-pink-200 hover:bg-pink-300 text-gray-900" },
  ];
  
  window.emotionColor = (id) => ({
    joy: "#FDE68A",
    sadness: "#BFDBFE",
    depression: "#E5E7EB",
    excitement: "#E9D5FF",
    peace: "#99F6E4",
    anger: "#FCA5A5",
    happiness: "#FED7AA",
    other: "#FBCFE8",
  }[id] || "#E5E7EB");
  
  window.placeholderIllustration = function (label, id) {
    const bg = window.emotionColor(id);
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='1536' height='1024'>
         <defs>
           <linearGradient id='g' x1='0' x2='1'>
             <stop offset='0' stop-color='${bg}' />
             <stop offset='1' stop-color='#ffffff'/>
           </linearGradient>
         </defs>
         <rect width='100%' height='100%' fill='url(#g)'/>
         <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle'
               font-family='Pretendard, Apple SD Gothic Neo, sans-serif'
               font-size='72' fill='#374151' opacity='0.85'>
           ${label} 이야기
         </text>
       </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  };
  