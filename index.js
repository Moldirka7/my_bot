const TelegramBot = require('node-telegram-bot-api');
const Anthropic = require('@anthropic-ai/sdk');

const TELEGRAM_TOKEN = 'ТВОЙ_ТОКЕН_ЗДЕСЬ';
const ANTHROPIC_API_KEY = 'ТВОЙ_API_КЛЮЧ_ЗДЕСЬ';

const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const userHistories = {};
const userDailyTasks = {};
const userOnceTasks = {};
const userDailyDone = {};
const states = {};

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

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userHistories[chatId] = [];
  userDailyDone[chatId] = {};
  bot.sendMessage(chatId, 'Привет! Я Боно 🤖 Твой личный ассистент и помощник.\n\nЯ помогу тебе следить за задачами и всегда готов выслушать 💙', mainMenu);
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  if (!text || text === '/start') return;

  if (!userHistories[chatId]) userHistories[chatId] = [];
  if (!userDailyTasks[chatId]) userDailyTasks[chatId] = [];
  if (!userOnceTasks[chatId]) userOnceTasks[chatId] = [];
  if (!userDailyDone[chatId]) userDailyDone[chatId] = {};

  if (states[chatId] === 'adding_daily') {
    userDailyTasks[chatId].push(text);
    states[chatId] = null;
    return bot.sendMessage(chatId, `✅ Добавила ежедневную задачу: *${text}*\nОна будет повторяться каждый день 🔁`, { parse_mode: 'Markdown', ...mainMenu });
  }

  if (states[chatId] === 'adding_once') {
    userOnceTasks[chatId].push({ text, done: false });
    states[chatId] = null;
    return bot.sendMessage(chatId, `✅ Добавила задачу: *${text}*`, { parse_mode: 'Markdown', ...mainMenu });
  }

  if (text === '📋 Мои задачи на сегодня') {
    const daily = userDailyTasks[chatId] || [];
    const once = userOnceTasks[chatId] || [];

    if (daily.length === 0 && once.length === 0) {
      return bot.sendMessage(chatId, 'Задач пока нет! Добавь их через кнопки ниже 😊', mainMenu);
    }

    let message = '📋 *Твои задачи на сегодня:*\n\n';

    const dailyButtons = daily.map((t, i) => [{
      text: `${userDailyDone[chatId][i] ? '✅' : '⬜'} ${t}`,
      callback_data: `daily_${i}`
    }]);

    const onceButtons = once.map((t, i) => [{
      text: `${t.done ? '✅' : '⬜'} ${t.text}`,
      callback_data: `once_${i}`
    }]);

    if (daily.length > 0) message += '🔁 *Ежедневные:*\n' + daily.map((t, i) => `${userDailyDone[chatId][i] ? '✅' : '⬜'} ${t}`).join('\n') + '\n\n';
    if (once.length > 0) message += '📌 *Одноразовые:*\n' + once.map(t => `${t.done ? '✅' : '⬜'} ${t.text}`).join('\n');

    return bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: [...dailyButtons, ...onceButtons] }
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

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (!userDailyDone[chatId]) userDailyDone[chatId] = {};

  if (data.startsWith('daily_')) {
    const index = parseInt(data.split('_')[1]);
    userDailyDone[chatId][index] = !userDailyDone[chatId][index];
    const done = userDailyDone[chatId][index];
    bot.answerCallbackQuery(query.id, { text: done ? '✅ Готово!' : '↩️ Убрала отметку' });

    const daily = userDailyTasks[chatId] || [];
    const once = userOnceTasks[chatId] || [];
    const dailyButtons = daily.map((t, i) => [{ text: `${userDailyDone[chatId][i] ? '✅' : '⬜'} ${t}`, callback_data: `daily_${i}` }]);
    const onceButtons = once.map((t, i) => [{ text: `${t.done ? '✅' : '⬜'} ${t.text}`, callback_data: `once_${i}` }]);
    bot.editMessageReplyMarkup({ inline_keyboard: [...dailyButtons, ...onceButtons] }, { chat_id: chatId, message_id: query.message.message_id });
  }

  if (data.startsWith('once_')) {
    const index = parseInt(data.split('_')[1]);
    if (userOnceTasks[chatId] && userOnceTasks[chatId][index]) {
      userOnceTasks[chatId][index].done = !userOnceTasks[chatId][index].done;
      const done = userOnceTasks[chatId][index].done;
      bot.answerCallbackQuery(query.id, { text: done ? '✅ Готово!' : '↩️ Убрала отметку' });

      const daily = userDailyTasks[chatId] || [];
      const once = userOnceTasks[chatId] || [];
      const dailyButtons = daily.map((t, i) => [{ text: `${userDailyDone[chatId][i] ? '✅' : '⬜'} ${t}`, callback_data: `daily_${i}` }]);
      const onceButtons = once.map((t, i) => [{ text: `${t.done ? '✅' : '⬜'} ${t.text}`, callback_data: `once_${i}` }]);
      bot.editMessageReplyMarkup({ inline_keyboard: [...dailyButtons, ...onceButtons] }, { chat_id: chatId, message_id: query.message.message_id });
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

      const dailyDone = Object.values(userDailyDone[chatId] || {}).filter(Boolean).length;
      const onceDone = once.filter(t => t.done).length;
      const totalTasks = daily.length + once.length;
      const totalDone = dailyDone + onceDone;
      const percent = Math.round((totalDone / totalTasks) * 100);

      const bar = '🟩'.repeat(Math.round(percent / 10)) + '⬜'.repeat(10 - Math.round(percent / 10));

      let summary = `🌙 *Итоги дня*\n\n`;
      summary += `${bar}\n*${percent}% выполнено* (${totalDone} из ${totalTasks})\n\n`;

      if (daily.length > 0) {
        summary += `🔁 *Ежедневные:* ${dailyDone}/${daily.length}\n`;
        daily.forEach((t, i) => summary += `${userDailyDone[chatId]?.[i] ? '✅' : '❌'} ${t}\n`);
        summary += '\n';
      }
      if (once.length > 0) {
        summary += `📌 *Одноразовые:* ${onceDone}/${once.length}\n`;
        once.forEach(t => summary += `${t.done ? '✅' : '❌'} ${t.text}\n`);
      }

      summary += `\nРасскажи как прошёл день — я выслушаю и помогу 💙`;

      await bot.sendMessage(chatId, summary, { parse_mode: 'Markdown', ...mainMenu });

      // Сброс на следующий день
      userOnceTasks[chatId] = [];
      userDailyDone[chatId] = {};
    }
    scheduleEveningCheck();
  }, ms);
}

scheduleEveningCheck();
console.log('Боно запущен! 🚀');