import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

async def test_gemini():
    api_key = os.getenv("GEMINI_API_KEY")
    print(f"Loaded GEMINI_API_KEY: {api_key[:10]}...{api_key[-10:] if api_key else ''}")
    
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        
        print("Sending simple request to Gemini...")
        response = model.generate_content("Hello! Verify connection.")
        print("Success! Response text:", response.text)
    except Exception as e:
        print("Gemini call raised exception:", str(e))

if __name__ == "__main__":
    asyncio.run(test_gemini())
