const TelegramBot = require('node-telegram-bot-api');
const Anthropic = require('@anthropic-ai/sdk');

const TELEGRAM_TOKEN = '8897220742:AAG1hsG1oZ1dIoXkvz2r3opoYAE67X9Rwq8';
const ANTHROPIC_API_KEY = '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';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const userHistories = {};

// Сотрудники
const EMPLOYEES = {
  '1024911846': 'Молдир админ'
};

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
  const name = msg.from.first_name || 'Пользователь';
  userHistories[chatId] = [];
  bot.sendMessage(chatId, `Привет, ${name}! Я Боно 🤖\n\nЯ твой личный ассистент и помощник 💙`, mainMenu);
});

bot.onText(/\/users/, (msg) => {
  const list = Object.entries(EMPLOYEES).map(([id, name]) => `${name}: ${id}`).join('\n');
  bot.sendMessage(msg.chat.id, '👥 Сотрудники:\n' + list);
});

// Команда для делегирования: /task ID текст_задачи
bot.onText(/\/task (.+)/, async (msg, match) => {
  const fromId = msg.chat.id;
  const parts = match[1].split(' ');
  const toId = parts[0];
  const taskText = parts.slice(1).join(' ');

  if (!EMPLOYEES[toId]) {
    return bot.sendMessage(fromId, 'Сотрудник не найден. Используй /users чтобы узнать ID');
  }
  if (!taskText) {
    return bot.sendMessage(fromId, 'Напиши текст задачи после ID');
  }

  try {
    await bot.sendMessage(toId,
      `📋 *Новая задача от руководителя!*\n\n${taskText}\n\nКогда выполнишь — нажми кнопку ниже 👇`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Выполнено!', callback_data: `done_${fromId}_${taskText.substring(0,30)}` }
          ]]
        }
      }
    );
    bot.sendMessage(fromId, `✅ Задача отправлена ${EMPLOYEES[toId]}!\n\n"${taskText}"`);
  } catch (e) {
    bot.sendMessage(fromId, 'Не удалось отправить задачу. Возможно сотрудник не запустил бота.');
  }
});

// Когда сотрудник нажимает "Выполнено"
bot.on('callback_query', async (query) => {
  const data = query.data;
  if (data.startsWith('done_')) {
    const parts = data.split('_');
    const bossId = parts[1];
    const taskText = parts.slice(2).join('_');
    const workerName = EMPLOYEES[query.from.id] || query.from.first_name;

    bot.answerCallbackQuery(query.id, { text: '✅ Отмечено как выполненное!' });
    bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id
    });

    await bot.sendMessage(bossId,
      `✅ *${workerName}* выполнил(а) задачу:\n\n"${taskText}"`,
      { parse_mode: 'Markdown' }
    );
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text.startsWith('/')) return;
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
  }
});

console.log('Боно запущен! 🚀');