const TelegramBot = require('node-telegram-bot-api');
const Anthropic = require('@anthropic-ai/sdk');

const TELEGRAM_TOKEN = '8941968173:AAEDQa0Lc6g8SwsBqVd0pX2fIjqgIurK8oE';
const ANTHROPIC_API_KEY = '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';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const userHistories = {};
const userDailyTasks = {};    // повторяющиеся каждый день
const userOnceTasks = {};     // одноразовые

const mainMenu = {
  reply_markup: {
    keyboard: [
      ['📋 Мои задачи на сегодня'],
      ['🔁 Добавить ежедневную задачу', '➕ Добавить одноразовую'],
      ['💬 Поговорить с Боно']
    ],
    resize_keyboard: true
  }
};

const states = {};

function getTodayTasks(chatId) {
  const daily = (userDailyTasks[chatId] || []).map(t => ({ text: t, done: false, type: 'daily' }));
  const once = (userOnceTasks[chatId] || []).map(t => ({ ...t, type: 'once' }));
  return [...daily, ...once];
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userHistories[chatId] = [];
  bot.sendMessage(chatId, 'Привет! Я Боно 🤖 Твой личный ассистент и помощник.\n\nЯ помогу тебе следить за задачами и всегда готов выслушать 💙', mainMenu);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text === '/start') return;

  if (!userHistories[chatId]) userHistories[chatId] = [];
  if (!userDailyTasks[chatId]) userDailyTasks[chatId] = [];
  if (!userOnceTasks[chatId]) userOnceTasks[chatId] = [];

  // Состояния ввода
  if (states[chatId] === 'adding_daily') {
    userDailyTasks[chatId].push(text);
    states[chatId] = null;
    return bot.sendMessage(chatId, `✅ Добавила ежедневную задачу: *${text}*\nОна будет повторяться каждый день 🔁`, { parse_mode: 'Markdown', ...mainMenu });
  }

  if (states[chatId] === 'adding_once') {
    if (!userOnceTasks[chatId]) userOnceTasks[chatId] = [];
    userOnceTasks[chatId].push({ text, done: false });
    states[chatId] = null;
    return bot.sendMessage(chatId, `✅ Добавила задачу: *${text}*`, { parse_mode: 'Markdown', ...mainMenu });
  }

  // Кнопки
  if (text === '📋 Мои задачи на сегодня') {
    const daily = userDailyTasks[chatId] || [];
    const once = userOnceTasks[chatId] || [];

    if (daily.length === 0 && once.length === 0) {
      return bot.sendMessage(chatId, 'Задач пока нет! Добавь их через кнопки ниже 😊', mainMenu);
    }

    let message = '📋 *Твои задачи на сегодня:*\n\n';
    if (daily.length > 0) {
      message += '🔁 *Ежедневные:*\n';
      daily.forEach((t, i) => message += `⬜ ${i + 1}. ${t}\n`);
      message += '\n';
    }
    if (once.length > 0) {
      message += '📌 *Одноразовые:*\n';
      once.forEach((t, i) => message += `${t.done ? '✅' : '⬜'} ${i + 1}. ${t.text}\n`);
    }

    const buttons = once.map((t, i) => [{
      text: `${t.done ? '✅' : '⬜'} ${t.text}`,
      callback_data: `toggle_${i}`
    }]);

    return bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: buttons.length > 0 ? { inline_keyboard: buttons } : mainMenu.reply_markup
    });
  }

  if (text === '🔁 Добавить ежедневную задачу') {
    states[chatId] = 'adding_daily';
    return bot.sendMessage(chatId, 'Напиши задачу которая будет повторяться каждый день 🔁\n\nНапример: *Выпить 2л воды*', { parse_mode: 'Markdown' });
  }

  if (text === '➕ Добавить одноразовую') {
    states[chatId] = 'adding_once';
    return bot.sendMessage(chatId, 'Напиши одноразовую задачу на сегодня 📌\n\nНапример: *Позвонить врачу*', { parse_mode: 'Markdown' });
  }

  if (text === '💬 Поговорить с Боно') {
    return bot.sendMessage(chatId, 'Слушаю тебя 💙 Расскажи что на душе или спроси что хочешь!', mainMenu);
  }

  // ИИ разговор
  userHistories[chatId].push({ role: 'user', content: text });
  try {
    bot.sendChatAction(chatId, 'typing');
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'Ты личный ассистент по имени Боно. Ты умный, дружелюбный и поддерживающий. Отвечаешь на русском языке. Можешь помочь с любыми вопросами — как психолог, советник, помощник. Всегда отвечай тепло и по-человечески.',
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

// Отметить одноразовые задачи
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith('toggle_')) {
    const index = parseInt(data.split('_')[1]);
    if (userOnceTasks[chatId] && userOnceTasks[chatId][index]) {
      userOnceTasks[chatId][index].done = !userOnceTasks[chatId][index].done;
      const done = userOnceTasks[chatId][index].done;
      bot.answerCallbackQuery(query.id, { text: done ? '✅ Готово!' : '↩️ Убрала отметку' });

      const buttons = userOnceTasks[chatId].map((t, i) => [{
        text: `${t.done ? '✅' : '⬜'} ${t.text}`,
        callback_data: `toggle_${i}`
      }]);
      bot.editMessageReplyMarkup({ inline_keyboard: buttons }, {
        chat_id: chatId,
        message_id: query.message.message_id
      });
    }
  }
});

// Вечерний анализ в 23:00 по Казахстану (UTC+5 = 18:00 UTC)
function scheduleEveningCheck() {
  const now = new Date();
  const next = new Date();
  next.setUTCHours(18, 0, 0, 0);
  if (now >= next) next.setDate(next.getDate() + 1);
  const ms = next - now;

  setTimeout(async () => {
    for (const chatId of Object.keys(userDailyTasks)) {
      const daily = userDailyTasks[chatId] || [];
      const once = userOnceTasks[chatId] || [];

      if (daily.length === 0 && once.length === 0) continue;

      const doneOnce = once.filter(t => t.done).length;
      const totalOnce = once.length;
      const totalDaily = daily.length;

      let summary = `🌙 *Добрый вечер!*\n\nКак прошёл твой день?\n\n`;
      if (totalDaily > 0) {
        summary += `🔁 Ежедневных задач: ${totalDaily}\n`;
      }
      if (totalOnce > 0) {
        summary += `📌 Одноразовых выполнено: ${doneOnce} из ${totalOnce}\n`;
      }
      summary += `\nРасскажи — что удалось, что нет? Я проанализирую твой день 💙`;

      bot.sendMessage(chatId, summary, { parse_mode: 'Markdown', ...mainMenu });

      // Сбрасываем одноразовые задачи
      userOnceTasks[chatId] = [];
    }
    scheduleEveningCheck();
  }, ms);
}

scheduleEveningCheck();
console.log('Боно запущен! 🚀');