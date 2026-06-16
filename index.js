const TelegramBot = require('node-telegram-bot-api');
const Anthropic = require('@anthropic-ai/sdk');

const TELEGRAM_TOKEN = '8941968173:AAEDQa0Lc6g8SwsBqVd0pX2fIjqgIurK8oE';
const ANTHROPIC_API_KEY = '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';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const userHistories = {};

const mainMenu = {
  reply_markup: {
    keyboard: [
      ['📱 Открыть приложение'],
      ['💬 Поговорить с Боно']
    ],
    resize_keyboard: true
  }
};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userHistories[chatId] = [];
  bot.sendMessage(chatId, 'Привет! Я Боно 🤖 Твой личный ассистент.\n\nВсе твои задачи, финансы, дневник и поездки — в приложении 👇', mainMenu);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text === '/start') return;
  if (!userHistories[chatId]) userHistories[chatId] = [];

  if (text === '📱 Открыть приложение') {
    return bot.sendMessage(chatId, 'Нажми чтобы открыть 👇', {
      reply_markup: {
        inline_keyboard: [[{
          text: '📱 Открыть Боно App',
          web_app: { url: 'https://moldirka7.github.io/my_bot/webapp.html' }
        }]]
      }
    });
  }

  if (text === '💬 Поговорить с Боно') {
    return bot.sendMessage(chatId, 'Слушаю тебя 💙 Расскажи что на душе!', mainMenu);
  }

  userHistories[chatId].push({ role: 'user', content: text });
  try {
    bot.sendChatAction(chatId, 'typing');
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'Ты личный ассистент по имени Боно. Ты умный, дружелюбный и поддерживающий. Отвечаешь на русском языке. Помогаешь с любыми вопросами — как психолог, советник, помощник. Всегда отвечай тепло и по-человечески.',
      messages: userHistories[chatId],
    });
    const reply = response.content[0].text;
    userHistories[chatId].push({ role: 'assistant', content: reply });
    bot.sendMessage(chatId, reply, mainMenu);
  } catch (error) {
    bot.sendMessage(chatId, 'Ой, что-то пошло не так 😔 Попробуй ещё раз', mainMenu);
    console.error(error);
  }
});

console.log('Боно запущен! 🚀');