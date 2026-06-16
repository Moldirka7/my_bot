const TelegramBot = require('node-telegram-bot-api');
const Anthropic = require('@anthropic-ai/sdk');

const TELEGRAM_TOKEN = '8941968173:AAEDQa0Lc6g8SwsBqVd0pX2fIjqgIurK8oE';
const ANTHROPIC_API_KEY = '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';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const userHistories = {};

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userMessage = msg.text;

  if (!userMessage) return;

  if (userMessage === '/start') {
    userHistories[chatId] = [];
    return bot.sendMessage(chatId, 'Привет! Я твой личный ассистент 🙃  Спрашивай всё что хочешь!');
  }

  if (!userHistories[chatId]) userHistories[chatId] = [];

  userHistories[chatId].push({ role: 'user', content: userMessage });
  try {
    bot.sendChatAction(chatId, 'typing');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'Ты личный ассистент по имени Боно. Ты умная, дружелюбная и поддерживающая. Отвечаешь на русском языке. Можешь помочь с любыми вопросами — как психолог, советник, помощник. Всегда отвечай тепло и по-человечески.',
      messages: userHistories[chatId],
    });

    const reply = response.content[0].text;
    userHistories[chatId].push({ role: 'assistant', content: reply });

    bot.sendMessage(chatId, reply);
  } catch (error) {
    bot.sendMessage(chatId, 'Ой, что-то пошло не так 😔 Попробуй ещё раз');
    console.error(error);
  }
});

console.log('Бот запущен! 🚀');