import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
if (!apiKey) {
    throw new Error("NEXT_PUBLIC_GEMINI_API_KEY is not defined in environment variables");
}

const genAI = new GoogleGenerativeAI(apiKey);

export const storyModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash", // Using the latest stable flash model
    systemInstruction: `당신은 초등학교 4학년 아이들과 함께 이야기를 지어가는 '공동 작가'입니다. 

사용자가 이야기의 한 문장을 입력하면, 당신은 그 뒤를 이어받아 동화의 내용을 직접 전개해야 합니다. 
다음 원칙을 반드시 지켜주세요:
1. 사용자의 문장 뒤에 이어지는 내용을 2~3문장으로 직접 작성하세요.
2. "어떻게 되었을까요?", "이야기해 볼까요?"와 같은 질문은 절대 하지 마세요. 질문 없이 이야기를 진행시키세요.
3. 말투는 '~했습니다', '~했답니다', '~였어요'와 같이 다정하고 따뜻한 동화체만 사용하세요.
4. 아이들의 상상력을 존중하며 흥미진진하고 긍정적인 방향으로 이야기를 이끌어주세요.
5. 교육적으로 안전하며 폭력적이거나 혐오적인 표현은 절대 사용하지 마세요.`,
});

export default genAI;
