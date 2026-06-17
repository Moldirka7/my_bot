const TelegramBot = require('node-telegram-bot-api');
const Anthropic = require('@anthropic-ai/sdk');

const TELEGRAM_TOKEN = '8897220742:AAG1hsG1oZ1dIoXkvz2r3opoYAE67X9Rwq8';
const ANTHROPIC_API_KEY = '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';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const userHistories = {};

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
  bot.sendMessage(chatId, 'Привет, ' + name + '! Я Боно. Твой личный ассистент!', mainMenu);
});

bot.onText(/\/users/, (msg) => {
  const list = Object.entries(EMPLOYEES).map(function(e) { return e[1] + ': ' + e[0]; }).join('\n');
  bot.sendMessage(msg.chat.id, 'Сотрудники:\n' + list);
});

bot.onText(/\/task (.+)/, async function(msg, match) {
  const fromId = String(msg.chat.id);
  const parts = match[1].split(' ');
  const toId = parts[0];
  const taskText = parts.slice(1).join(' ');

  if (!EMPLOYEES[toId]) {
    return bot.sendMessage(fromId, 'Сотрудник не найден');
  }
  if (!taskText) {
    return bot.sendMessage(fromId, 'Напиши текст задачи после ID');
  }

  try {
    await bot.sendMessage(toId, 'Новая задача: ' + taskText, {
      reply_markup: {
        inline_keyboard: [[
          { text: 'Выполнено!', callback_data: 'done_' + fromId }
        ]]
      }
    });
    bot.sendMessage(fromId, 'Задача отправлена ' + EMPLOYEES[toId] + ': ' + taskText);
  } catch(e) {
    bot.sendMessage(fromId, 'Не удалось отправить: ' + e.message);
  }
});

bot.on('callback_query', async function(query) {
  if (query.data.startsWith('done_')) {
    const bossId = query.data.split('_')[1];
    const workerName = query.from.first_name;
    bot.answerCallbackQuery(query.id, { text: 'Отмечено!' });
    bot.sendMessage(bossId, workerName + ' выполнил(а) задачу!');
  }
});

bot.on('message', async function(msg) {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text.startsWith('/')) return;
  if (!userHistories[chatId]) userHistories[chatId] = [];

  if (text === '📱 Открыть приложение') {
    return bot.sendMessage(chatId, 'Открывай!', {
      reply_markup: {
        inline_keyboard: [[{
          text: 'Открыть Боно App',
          web_app: { url: 'https://moldirka7.github.io/my_bot/webapp.html' }
        }]]
      }
    });
  }

  if (text === '💬 Поговорить с Боно') {
    return bot.sendMessage(chatId, 'Слушаю тебя! Расскажи что на душе.', mainMenu);
  }

  userHistories[chatId].push({ role: 'user', content: text });

  try {
    bot.sendChatAction(chatId, 'typing');
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: 'Ты ассистент по имени Боно. Отвечай на русском, тепло и дружелюбно.',
      messages: userHistories[chatId]
    });
    const reply = response.content[0].text;
    userHistories[chatId].push({ role: 'assistant', content: reply });
    bot.sendMessage(chatId, reply, mainMenu);
  } catch(e) {
    console.error('API error:', e.message);
    bot.sendMessage(chatId, 'Извини, произошла ошибка: ' + e.message, mainMenu);
  }
});

console.log('Боно запущен!');