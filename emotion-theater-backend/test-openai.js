// Test script to verify Azure OpenAI connection
const { AzureOpenAI } = require("openai");
require('dotenv').config();

const openai = new AzureOpenAI({
  azureEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_KEY,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION,
});

async function testConnection() {
  console.log('\n=== Testing Azure OpenAI Connection ===');
  console.log('Endpoint:', process.env.AZURE_OPENAI_ENDPOINT);
  console.log('Deployment:', process.env.AZURE_OPENAI_DEPLOYMENT_CHAT);
  console.log('API Version:', process.env.AZURE_OPENAI_API_VERSION);
  console.log('API Key:', process.env.AZURE_OPENAI_KEY ? `${process.env.AZURE_OPENAI_KEY.substring(0, 10)}...` : 'NOT SET');
  console.log('\n=== Attempting API Call ===\n');

  try {
    const response = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_CHAT,
      messages: [
        { role: "user", content: "Hello, this is a test message. Please respond with 'OK'." }
      ],
      max_tokens: 10,
    });

    console.log('✅ Success! Response:', response.choices[0]?.message?.content);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  }
}

testConnection();
