// openai.js

const { OpenAI } = require('openai');

// Initialize OpenAI client with your API key from .env
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Function to generate SQL from a natural language query
async function generateSqlQuery(userQuery, schema) {
  const prompt = `
  You are a SQL expert. Given this database schema for a financial dashboard:
  ${schema}
  Generate an SQL query to answer: "${userQuery}"
  Return only the SQL query in triple backticks (```sql ... ```).
  `;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Or 'gpt-3.5-turbo'
      messages: [
        { role: 'system', content: 'You are a SQL query generator.' },
        { role: 'user', content: prompt },
      ],
    });

    const generatedText = response.choices[0].message.content;
    const sqlQuery = generatedText.match(/```sql\n([\s\S]*?)\n```/)[1].trim();
    return sqlQuery;
  } catch (error) {
    console.error('Error generating SQL:', error);
    throw new Error('Failed to generate SQL query');
  }
}

module.exports = { generateSqlQuery };