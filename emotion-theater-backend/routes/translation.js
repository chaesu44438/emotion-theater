const express = require('express');
const router = express.Router();
const { AzureOpenAI } = require("openai");

// Initialize a new AzureOpenAI client for translation
// This uses the same environment variables as the story generation
const textClient = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_KEY,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
});

router.post('/translate', async (req, res) => {
    const { text, to = 'en' } = req.body; // Default to English
    if (!text) {
        return res.status(400).json({ error: 'Text for translation is required.' });
    }

    const languageMap = {
        en: 'English',
        ko: 'Korean',
        zh: 'Chinese',
        ja: 'Japanese',
    };
    const targetLanguage = languageMap[to] || 'English'; // Default to English

    const systemPrompt = `You are a helpful assistant that translates text. Translate the user's text to ${targetLanguage}. Respond only with the translated text, without any additional explanations or conversational text.`;
    const userPrompt = text;

    try {
        console.log(`[Translate] Translating text to ${to} (${targetLanguage}) using Azure OpenAI...`);

        const response = await textClient.chat.completions.create({
            model: process.env.AZURE_OPENAI_DEPLOYMENT_CHAT,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            max_tokens: 2500,
            temperature: 0.2, // Lower temperature for more deterministic translation
        });

        const translation = response.choices[0]?.message?.content?.trim();

        if (!translation) {
            throw new Error("Azure OpenAI returned an empty translation.");
        }

        console.log("[Translate] Translation successful.");
        res.json({ translation });

    } catch (error) {
        console.error('Error translating text with Azure OpenAI:', error);
        res.status(500).json({ error: 'Failed to translate text.' });
    }
});

module.exports = router;