import { useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import {
  Home,
  BarChart3,
  Calendar as CalendarIcon,
  Settings as SettingsIcon,
  Plus,
  X,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  ListChecks,
  Check,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const DEFAULT_CATEGORIES = ['食費', '日用品', '光熱費', '通信費', '住居費', '交通費', '娯楽', '医療', 'その他'];
const CATEGORY_COLORS = ['#F2994A', '#EB5757', '#9B51E0', '#F2C94C', '#56CCF2', '#BB6BD9', '#6FCF97', '#EB9694', '#4F86C6', '#A0A4A8'];
const PERSON_COLORS = { A: '#12A870', B: '#3478F6', SHARED: '#8B5CF6' };

function monthKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
function shiftMonthKey(key, delta) {
  const [y, m] = key.split('-').map(Number);
  return monthKeyOf(new Date(y, m - 1 + delta, 1));
}
function formatMonthLabel(key) {
  const [y, m] = key.split('-');
  return `${y}年${parseInt(m, 10)}月`;
}
function formatMonthShort(key) {
  const [y, m] = key.split('-');
  return `${y}/${parseInt(m, 10)}`;
}
function formatYen(n) {
  return '¥' + Math.round(n || 0).toLocaleString('ja-JP');
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function formatDateLabel(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}
function categoryColor(categories, name) {
  const idx = categories.indexOf(name);
  return CATEGORY_COLORS[(idx >= 0 ? idx : 0) % CATEGORY_COLORS.length];
}
function buildCalendarWeeks(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const startWeekday = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// key(文字列)1件を読み込み、リアルタイム購読も行う共通フック
// 戻り値: { status: 'loading'|'ready'|'error', value, error }
function useSupabaseDoc(key) {
  const [state, setState] = useState({ status: 'loading', value: null, error: null });
  const instanceId = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (!key) return;
    let active = true;
    setState({ status: 'loading', value: null, error: null });

    (async () => {
      const { data, error } = await supabase.from('warikan_data').select('value').eq('key', key).maybeSingle();
      if (!active) return;
      if (error) {
        setState({ status: 'error', value: null, error });
      } else {
        setState({ status: 'ready', value: data ? data.value : null, error: null });
      }
    })();

    const channel = supabase
      .channel('doc-' + key + '-' + instanceId.current)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'warikan_data', filter: `key=eq.${key}` },
        (payload) => {
          if (!active) return;
          if (payload.eventType === 'DELETE') {
            setState({ status: 'ready', value: null, error: null });
          } else {
            setState({ status: 'ready', value: payload.new.value, error: null });
          }
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [key]);

  return state;
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('month');

  const [setupA, setSetupA] = useState('');
  const [setupB, setSetupB] = useState('');

  // ---- 今月タブ ----
  const [monthKeyState, setMonthKeyState] = useState(monthKeyOf(new Date()));
  const [expenses, setExpenses] = useState([]);
  const [settled, setSettled] = useState(false);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [fDate, setFDate] = useState(todayStr());
  const [fCategory, setFCategory] = useState('');
  const [fUsage, setFUsage] = useState('');
  const [fAmount, setFAmount] = useState('');
  const [fPayer, setFPayer] = useState('A');
  const [fMemo, setFMemo] = useState('');

  // ---- 統計タブ ----
  const [statsMonthKey, setStatsMonthKey] = useState(monthKeyOf(new Date()));
  const [statsExpenses, setStatsExpenses] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [barEndMonth, setBarEndMonth] = useState(monthKeyOf(new Date()));
  const [barData, setBarData] = useState([]);
  const [barLoading, setBarLoading] = useState(true);

  // ---- 予定表タブ ----
  const [calendarMonthKey, setCalendarMonthKey] = useState(monthKeyOf(new Date()));
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [dayPopupMode, setDayPopupMode] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);
  const [eTitle, setETitle] = useState('');
  const [eDate, setEDate] = useState(todayStr());
  const [eAllDay, setEAllDay] = useState(true);
  const [eStartTime, setEStartTime] = useState('');
  const [eEndTime, setEEndTime] = useState('');
  const [ePerson, setEPerson] = useState('A');
  const [eMemo, setEMemo] = useState('');

  // ---- ToDoタブ ----
  const [todos, setTodos] = useState([]);
  const [todosLoading, setTodosLoading] = useState(true);
  const [newTodoText, setNewTodoText] = useState('');
  const [memoText, setMemoText] = useState('');
  const [memoLoading, setMemoLoading] = useState(true);
  const memoInitialized = useRef(false);

  async function saveDoc(key, value) {
    const { error: err } = await supabase.from('warikan_data').upsert({ key, value });
    if (err) {
      console.error(err);
      setError('保存に失敗しました：' + err.message);
      return false;
    }
    setError('');
    return true;
  }

  // 設定
  const settingsDoc = useSupabaseDoc('settings');
  useEffect(() => {
    if (settingsDoc.status === 'loading') return;
    setLoading(false);
    if (settingsDoc.status === 'error') {
      setError('Supabaseへの接続に失敗しました：' + settingsDoc.error.message + '（src/supabase.js の設定値を確認してください）');
      return;
    }
    if (settingsDoc.value === null) {
      setNeedsSetup(true);
      return;
    }
    setSettings(settingsDoc.value);
    setSetupA(settingsDoc.value.personA);
    setSetupB(settingsDoc.value.personB);
    setNeedsSetup(false);
    setError('');
  }, [settingsDoc]);

  // 今月タブの支出
  const monthDoc = useSupabaseDoc('expenses:' + monthKeyState);
  useEffect(() => {
    if (monthDoc.status === 'loading') {
      setExpensesLoading(true);
      return;
    }
    setExpensesLoading(false);
    if (monthDoc.status === 'error' || monthDoc.value === null) {
      setExpenses([]);
      setSettled(false);
      return;
    }
    setExpenses(monthDoc.value.items || []);
    setSettled(!!monthDoc.value.settled);
  }, [monthDoc]);

  // 統計タブ：円グラフ対象月
  const statsDoc = useSupabaseDoc('expenses:' + statsMonthKey);
  useEffect(() => {
    if (statsDoc.status === 'loading') {
      setStatsLoading(true);
      return;
    }
    setStatsLoading(false);
    if (statsDoc.status === 'error' || statsDoc.value === null) {
      setStatsExpenses([]);
      return;
    }
    setStatsExpenses(statsDoc.value.items || []);
  }, [statsDoc]);

  // 統計タブ：直近12ヶ月の推移（一度だけ取得）
  useEffect(() => {
    (async () => {
      setBarLoading(true);
      const months = [];
      for (let i = 11; i >= 0; i--) months.push(shiftMonthKey(barEndMonth, -i));
      const results = await Promise.all(
        months.map(async (mk) => {
          const { data } = await supabase.from('warikan_data').select('value').eq('key', 'expenses:' + mk).maybeSingle();
          const items = data && data.value ? data.value.items || [] : [];
          return { month: mk, label: formatMonthShort(mk), total: items.reduce((s, e) => s + e.amount, 0) };
        })
      );
      setBarData(results);
      setBarLoading(false);
    })();
  }, [barEndMonth]);

  // 予定表タブ
  const eventsDoc = useSupabaseDoc('events:' + calendarMonthKey);
  useEffect(() => {
    if (eventsDoc.status === 'loading') {
      setEventsLoading(true);
      return;
    }
    setEventsLoading(false);
    if (eventsDoc.status === 'error' || eventsDoc.value === null) {
      setEvents([]);
      return;
    }
    setEvents(eventsDoc.value.items || []);
  }, [eventsDoc]);

  // ToDo
  const todosDoc = useSupabaseDoc('todos');
  useEffect(() => {
    if (todosDoc.status === 'loading') {
      setTodosLoading(true);
      return;
    }
    setTodosLoading(false);
    if (todosDoc.status === 'error' || todosDoc.value === null) {
      setTodos([]);
      return;
    }
    setTodos(todosDoc.value.items || []);
  }, [todosDoc]);

  // メモ
  const memoDoc = useSupabaseDoc('memo');
  useEffect(() => {
    if (memoDoc.status === 'loading') {
      setMemoLoading(true);
      return;
    }
    setMemoLoading(false);
    if (memoDoc.status !== 'error' && memoDoc.value !== null) {
      setMemoText(memoDoc.value.text || '');
    }
    memoInitialized.current = true;
  }, [memoDoc]);
  useEffect(() => {
    if (!memoInitialized.current) return;
    const timer = setTimeout(() => {
      saveDoc('memo', { text: memoText });
    }, 800);
    return () => clearTimeout(timer);
  }, [memoText]);

  async function saveSettings(personA, personB, categories) {
    const name1 = (personA || '').trim() || '夫';
    const name2 = (personB || '').trim() || '妻';
    const next = { personA: name1, personB: name2, categories: categories || (settings ? settings.categories : DEFAULT_CATEGORIES) };
    await saveDoc('settings', next);
  }

  async function persistMonth(list, settledFlag) {
    await saveDoc('expenses:' + monthKeyState, { items: list, settled: settledFlag });
  }

  async function toggleSettled() {
    await persistMonth(expenses, !settled);
  }

  function resetExpenseForm() {
    setFDate(todayStr());
    setFCategory((settings && settings.categories && settings.categories[0]) || '');
    setFUsage('');
    setFAmount('');
    setFPayer('A');
    setFMemo('');
    setEditingId(null);
    setShowNewCategoryInput(false);
    setNewCategoryInput('');
  }

  function openAddExpense() {
    if (settled) {
      setActiveTab('month');
      setError(`${formatMonthLabel(monthKeyState)}は精算済みのため追加できません。編集するには先に精算を解除してください。`);
      return;
    }
    resetExpenseForm();
    setShowAddExpense(true);
  }

  function openEditExpense(exp) {
    if (settled) return;
    setFDate(exp.date);
    setFCategory(exp.category);
    setFUsage(exp.usage || '');
    setFAmount(String(exp.amount));
    setFPayer(exp.payer);
    setFMemo(exp.memo || '');
    setEditingId(exp.id);
    setShowNewCategoryInput(false);
    setShowAddExpense(true);
  }

  async function submitExpense() {
    const amt = parseFloat(fAmount);
    if (!fCategory || !amt || amt <= 0) {
      setError('カテゴリと金額を入力してください。');
      return;
    }
    let next;
    if (editingId) {
      next = expenses.map((e) => (e.id === editingId ? { ...e, date: fDate, category: fCategory, usage: fUsage, amount: amt, payer: fPayer, memo: fMemo } : e));
    } else {
      next = [
        ...expenses,
        { id: Date.now() + '-' + Math.random().toString(36).slice(2, 8), date: fDate, category: fCategory, usage: fUsage, amount: amt, payer: fPayer, memo: fMemo },
      ];
    }
    next.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    setError('');
    await persistMonth(next, settled);
    setShowAddExpense(false);
    resetExpenseForm();
  }

  async function deleteExpense(id) {
    if (settled) return;
    await persistMonth(expenses.filter((e) => e.id !== id), settled);
  }

  function addCategory() {
    const cat = newCategoryInput.trim();
    if (!cat || settings.categories.includes(cat)) {
      setShowNewCategoryInput(false);
      setNewCategoryInput('');
      return;
    }
    saveSettings(settings.personA, settings.personB, [...settings.categories, cat]);
    setFCategory(cat);
    setShowNewCategoryInput(false);
    setNewCategoryInput('');
  }

  function removeCategory(cat) {
    saveSettings(settings.personA, settings.personB, settings.categories.filter((c) => c !== cat));
  }

  async function persistEvents(list) {
    await saveDoc('events:' + calendarMonthKey, { items: list });
  }

  function openDay(date) {
    setSelectedDate(date);
    setDayPopupMode('list');
  }
  function closeDayPopup() {
    setDayPopupMode(null);
  }

  function openAddEvent(dateStr) {
    setETitle('');
    setEDate(dateStr || selectedDate || todayStr());
    setEAllDay(true);
    setEStartTime('');
    setEEndTime('');
    setEPerson('A');
    setEMemo('');
    setEditingEventId(null);
    setDayPopupMode('form');
  }
  function openEditEvent(ev) {
    setETitle(ev.title);
    setEDate(ev.date);
    setEAllDay(ev.allDay !== false && !ev.startTime);
    setEStartTime(ev.startTime || '');
    setEEndTime(ev.endTime || '');
    setEPerson(ev.person);
    setEMemo(ev.memo || '');
    setEditingEventId(ev.id);
    setDayPopupMode('form');
  }
  async function submitEvent() {
    if (!eTitle.trim() || !eDate) {
      setError('タイトルと日付を入力してください。');
      return;
    }
    const key = eDate.slice(0, 7);
    const eventFields = {
      title: eTitle,
      date: eDate,
      allDay: eAllDay,
      startTime: eAllDay ? '' : eStartTime,
      endTime: eAllDay ? '' : eEndTime,
      person: ePerson,
      memo: eMemo,
    };
    setError('');
    if (key === calendarMonthKey) {
      let next;
      if (editingEventId) {
        next = events.map((ev) => (ev.id === editingEventId ? { ...ev, ...eventFields } : ev));
      } else {
        next = [...events, { id: Date.now() + '-' + Math.random().toString(36).slice(2, 8), ...eventFields }];
      }
      await saveDoc('events:' + key, { items: next });
    } else {
      const { data } = await supabase.from('warikan_data').select('value').eq('key', 'events:' + key).maybeSingle();
      const base = data && data.value ? data.value.items || [] : [];
      let next;
      if (editingEventId) {
        next = base.map((ev) => (ev.id === editingEventId ? { ...ev, ...eventFields } : ev));
      } else {
        next = [...base, { id: Date.now() + '-' + Math.random().toString(36).slice(2, 8), ...eventFields }];
      }
      await saveDoc('events:' + key, { items: next });
      setCalendarMonthKey(key);
    }
    setSelectedDate(eDate);
    setDayPopupMode('list');
  }
  async function deleteEvent(id) {
    await persistEvents(events.filter((e) => e.id !== id));
  }
  function formatEventTime(ev) {
    if (ev.allDay || (!ev.startTime && !ev.endTime)) return '終日';
    if (ev.startTime && ev.endTime) return `${ev.startTime}〜${ev.endTime}`;
    if (ev.startTime) return `${ev.startTime}〜`;
    return '終日';
  }

  async function persistTodos(list) {
    await saveDoc('todos', { items: list });
  }
  function addTodo() {
    const text = newTodoText.trim();
    if (!text) return;
    persistTodos([...todos, { id: Date.now() + '-' + Math.random().toString(36).slice(2, 8), text, done: false }]);
    setNewTodoText('');
  }
  function toggleTodo(id) {
    persistTodos(todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }
  function deleteTodo(id) {
    persistTodos(todos.filter((t) => t.id !== id));
  }

  const totalAll = expenses.reduce((s, e) => s + e.amount, 0);
  const paidByA = expenses.filter((e) => e.payer === 'A').reduce((s, e) => s + e.amount, 0);
  const paidByB = expenses.filter((e) => e.payer === 'B').reduce((s, e) => s + e.amount, 0);
  const diff = paidByA - paidByB;
  const settleAmount = Math.abs(diff) / 2;
  const monthByCategory = {};
  expenses.forEach((e) => {
    monthByCategory[e.category] = (monthByCategory[e.category] || 0) + e.amount;
  });
  const monthCategoryRows = Object.entries(monthByCategory).sort((a, b) => b[1] - a[1]);

  const statsByCategory = {};
  statsExpenses.forEach((e) => {
    statsByCategory[e.category] = (statsByCategory[e.category] || 0) + e.amount;
  });
  const pieData = Object.entries(statsByCategory)
    .map(([name, value]) => ({ name, value, color: settings ? categoryColor(settings.categories, name) : '#ccc' }))
    .sort((a, b) => b.value - a.value);
  const statsTotal = statsExpenses.reduce((s, e) => s + e.amount, 0);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;900&display=swap');
    .wk-app { --bg:#F5F6F8; --card:#FFFFFF; --ink:#1F2933; --ink-soft:#8A94A6; --line:#E4E7EC;
      --brand:#12A870; --brand-soft:#E3F6ED; --blue:#3478F6; --blue-soft:#E8F0FE;
      --purple:#8B5CF6; --purple-soft:#F1EBFF; --red:#E5484D; --red-soft:#FDECEC;
      font-family:'Noto Sans JP', sans-serif; background:var(--bg); color:var(--ink);
      min-height:100vh; box-sizing:border-box; padding-bottom:78px; }
    .wk-app *{ box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
    .wk-shell{ max-width:460px; margin:0 auto; padding:16px 14px 10px; }
    .wk-topbar{ display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
    .wk-logo{ font-size:18px; font-weight:900; color:var(--ink); display:flex; align-items:center; gap:6px; }
    .wk-logo-badge{ width:8px; height:8px; border-radius:50%; background:var(--brand); }
    .wk-banner{ background:var(--red-soft); border:1px solid var(--red); color:var(--red); font-size:11.5px;
      border-radius:9px; padding:8px 12px; margin-bottom:12px; }
    .wk-monthnav{ display:flex; align-items:center; justify-content:center; gap:16px; margin-bottom:12px; }
    .wk-monthbtn{ background:var(--card); border:1px solid var(--line); color:var(--ink-soft); width:30px; height:30px;
      display:flex; align-items:center; justify-content:center; border-radius:999px; }
    .wk-monthlabel{ font-size:16px; font-weight:700; min-width:104px; text-align:center; }
    .wk-card{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:18px 16px;
      margin-bottom:14px; }
    .wk-settle-toprow{ display:flex; align-items:center; justify-content:space-between; }
    .wk-settle-label{ font-size:12px; color:var(--ink-soft); }
    .wk-locked-badge{ display:flex; align-items:center; gap:4px; background:var(--brand-soft); color:var(--brand);
      font-size:11px; font-weight:700; padding:4px 10px; border-radius:999px; }
    .wk-settle-amount{ font-size:30px; font-weight:900; margin:6px 0 2px; }
    .wk-settle-who{ font-size:13.5px; color:var(--ink-soft); }
    .wk-settle-who b{ color:var(--brand); font-weight:700; }
    .wk-settle-who b.blue{ color:var(--blue); }
    .wk-stats{ display:flex; gap:8px; margin-top:14px; padding-top:14px; border-top:1px solid var(--line); }
    .wk-stat{ flex:1; }
    .wk-stat-label{ font-size:10.5px; color:var(--ink-soft); }
    .wk-stat-value{ font-size:14px; font-weight:700; margin-top:2px; }
    .wk-settlebtn{ width:100%; margin-top:14px; border:none; border-radius:10px; padding:11px; font-size:13.5px;
      font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px; }
    .wk-settlebtn.do{ background:var(--brand); color:#fff; }
    .wk-settlebtn.undo{ background:var(--card); color:var(--ink-soft); border:1px solid var(--line); }
    .wk-section-title{ font-size:12.5px; font-weight:700; color:var(--ink-soft); margin:18px 0 8px; }
    .wk-cat-row{ display:flex; align-items:center; gap:10px; padding:7px 0; }
    .wk-cat-dot{ width:26px; height:26px; border-radius:50%; flex-shrink:0; display:flex; align-items:center;
      justify-content:center; color:#fff; font-size:11px; font-weight:700; }
    .wk-cat-name{ font-size:13px; flex:1; }
    .wk-cat-amount{ font-size:13px; font-weight:700; }
    .wk-empty{ font-size:12.5px; color:var(--ink-soft); text-align:center; padding:22px 10px; }
    .wk-lockednotice{ display:flex; align-items:center; gap:6px; font-size:11.5px; color:var(--ink-soft);
      background:var(--bg); border-radius:8px; padding:8px 10px; margin-bottom:8px; }
    .wk-exp-row{ display:flex; align-items:center; justify-content:space-between; padding:10px 0;
      border-bottom:1px solid var(--line); }
    .wk-exp-left{ display:flex; align-items:center; gap:9px; min-width:0; }
    .wk-exp-cat{ background:var(--bg); border-radius:6px; padding:3px 8px; font-size:11px; color:var(--ink-soft);
      display:flex; align-items:center; gap:4px; max-width:120px; min-width:0; }
    .wk-exp-cat-dot{ width:6px; height:6px; border-radius:50%; flex-shrink:0; }
    .wk-exp-cat-text{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; min-width:0; }
    .wk-exp-meta{ min-width:0; }
    .wk-exp-date{ font-size:10.5px; color:var(--ink-soft); }
    .wk-exp-memo{ font-size:11px; color:var(--ink-soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:120px; }
    .wk-exp-right{ display:flex; align-items:center; gap:4px; flex-shrink:0; }
    .wk-exp-amount{ font-size:14px; font-weight:700; }
    .wk-iconbtn{ background:none; border:none; color:var(--ink-soft); padding:5px; display:flex; }
    .wk-tabbar{ position:fixed; bottom:0; left:0; right:0; background:#fff; border-top:1px solid var(--line);
      display:flex; align-items:center; justify-content:space-around; padding:6px 6px calc(6px + env(safe-area-inset-bottom));
      z-index:40; }
    .wk-tabbtn{ background:none; border:none; display:flex; flex-direction:column; align-items:center; gap:2px;
      color:var(--ink-soft); font-size:10px; padding:4px 6px; flex:1; }
    .wk-tabbtn.active{ color:var(--brand); font-weight:700; }
    .wk-fab{ position:fixed; right:18px; bottom:calc(70px + env(safe-area-inset-bottom)); background:var(--brand); color:#fff;
      width:54px; height:54px; border-radius:50%; display:flex; align-items:center; justify-content:center;
      box-shadow:0 4px 14px rgba(18,168,112,0.4); border:none; z-index:45; }
    .wk-overlay{ position:fixed; inset:0; background:rgba(20,25,30,0.45); display:flex; align-items:flex-end;
      justify-content:center; z-index:60; }
    .wk-sheet{ background:var(--bg); width:100%; max-width:460px; border-radius:20px 20px 0 0; padding:20px 18px 26px;
      max-height:88vh; overflow-y:auto; }
    .wk-sheet-header{ display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
    .wk-sheet-title{ font-size:16px; font-weight:700; }
    .wk-field{ margin-bottom:14px; }
    .wk-label{ font-size:12px; color:var(--ink-soft); margin-bottom:6px; display:block; }
    .wk-input{ width:100%; border:1px solid var(--line); border-radius:9px; padding:10px 12px; font-size:15px;
      background:#fff; color:var(--ink); font-family:'Noto Sans JP', sans-serif; }
    .wk-chips{ display:flex; flex-wrap:wrap; gap:8px; }
    .wk-chip{ border:1px solid var(--line); background:#fff; border-radius:999px; padding:7px 13px; font-size:13px;
      color:var(--ink); display:flex; align-items:center; gap:6px; }
    .wk-chip.active{ background:var(--brand); border-color:var(--brand); color:#fff; }
    .wk-payer-toggle{ display:flex; gap:10px; }
    .wk-payer-btn{ flex:1; border:1.5px solid var(--line); border-radius:10px; padding:12px 8px; font-size:13.5px;
      font-weight:700; background:#fff; color:var(--ink); }
    .wk-payer-btn.a-active{ background:var(--brand-soft); border-color:var(--brand); color:var(--brand); }
    .wk-payer-btn.b-active{ background:var(--blue-soft); border-color:var(--blue); color:var(--blue); }
    .wk-payer-btn.s-active{ background:var(--purple-soft); border-color:var(--purple); color:var(--purple); }
    .wk-btnrow{ display:flex; gap:10px; margin-top:20px; }
    .wk-btn-primary{ flex:2; background:var(--brand); color:#fff; border:none; border-radius:10px; padding:13px;
      font-size:15px; font-weight:700; }
    .wk-btn-secondary{ flex:1; background:none; border:1px solid var(--line); color:var(--ink-soft); border-radius:10px;
      padding:13px; font-size:14px; }
    .wk-error{ color:var(--red); font-size:12.5px; margin-top:10px; }
    .wk-setup-wrap{ max-width:420px; margin:60px auto; text-align:center; padding:0 14px; }
    .wk-setup-title{ font-size:22px; font-weight:900; margin-bottom:6px; }
    .wk-setup-sub{ font-size:13px; color:var(--ink-soft); margin-bottom:22px; }
    .wk-loading{ text-align:center; padding:80px 0; color:var(--ink-soft); font-size:14px; }
    .wk-piewrap{ display:flex; flex-direction:column; align-items:center; }
    .wk-legend{ width:100%; margin-top:10px; }
    .wk-barwrap{ margin-top:4px; }
    .wk-cal-weekdays{ display:grid; grid-template-columns:repeat(7,1fr); text-align:center; font-size:11px;
      color:var(--ink-soft); margin-bottom:4px; }
    .wk-cal-grid{ display:grid; grid-template-columns:repeat(7,1fr); gap:3px; }
    .wk-cal-cell{ min-height:58px; border-radius:8px; display:flex; flex-direction:column; align-items:center;
      padding:4px 2px 3px; font-size:11px; background:var(--bg); position:relative; border:none; overflow:hidden; }
    .wk-cal-cell.today{ border:1.5px solid var(--brand); }
    .wk-cal-cell.selected{ background:var(--brand-soft); }
    .wk-cal-cell.empty{ background:transparent; min-height:58px; }
    .wk-cal-daynum{ font-size:11px; color:var(--ink); margin-bottom:2px; flex-shrink:0; }
    .wk-cal-events{ width:100%; display:flex; flex-direction:column; gap:1.5px; align-items:stretch; }
    .wk-cal-chip-allday{ width:100%; font-size:8px; line-height:1.4; color:#fff; border-radius:3px; padding:1px 3px;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap; text-align:left; font-weight:600; }
    .wk-cal-chip-timed{ width:100%; font-size:8px; line-height:1.4; padding:1px 1px; overflow:hidden;
      text-overflow:ellipsis; white-space:nowrap; text-align:left; display:flex; align-items:center; gap:2px; font-weight:700; }
    .wk-cal-chip-dot{ width:4px; height:4px; border-radius:50%; flex-shrink:0; }
    .wk-cal-more{ font-size:7.5px; color:var(--ink-soft); text-align:left; padding-left:2px; }
    .wk-event-row{ display:flex; align-items:center; gap:9px; padding:9px 0; border-bottom:1px solid var(--line); }
    .wk-event-dot{ width:8px; height:8px; border-radius:50%; flex-shrink:0; }
    .wk-event-title{ font-size:13px; flex:1; }
    .wk-event-time{ font-size:11px; color:var(--ink-soft); }
    .wk-addday-btn{ width:100%; border:1px dashed var(--line); background:none; border-radius:10px; padding:10px;
      font-size:13px; color:var(--brand); font-weight:700; margin-top:8px; }
    .wk-textarea{ width:100%; border:1px solid var(--line); border-radius:9px; padding:10px 12px; font-size:14px;
      background:#fff; color:var(--ink); font-family:'Noto Sans JP', sans-serif; min-height:140px; resize:vertical; }
  `;

  const tabs = [
    { key: 'month', label: '今月', icon: Home },
    { key: 'stats', label: '統計', icon: BarChart3 },
    { key: 'calendar', label: '予定表', icon: CalendarIcon },
    { key: 'todo', label: 'ToDo', icon: ListChecks },
    { key: 'settings', label: '設定', icon: SettingsIcon },
  ];

  if (loading) {
    return (
      <div className="wk-app">
        <style>{css}</style>
        <div className="wk-loading">読み込み中…</div>
        {error && (
          <div className="wk-shell">
            <div className="wk-banner">{error}</div>
          </div>
        )}
      </div>
    );
  }

  if (needsSetup || !settings) {
    return (
      <div className="wk-app">
        <style>{css}</style>
        <div className="wk-setup-wrap">
          <div className="wk-setup-title">わりかん帳</div>
          <div className="wk-setup-sub">ふたりの名前を登録してはじめましょう。Supabase経由でふたりの端末に自動同期されます。</div>
          <div className="wk-card" style={{ textAlign: 'left' }}>
            <div className="wk-field">
              <label className="wk-label">ひとり目の名前</label>
              <input className="wk-input" value={setupA} onChange={(e) => setSetupA(e.target.value)} placeholder="例：たろう" />
            </div>
            <div className="wk-field">
              <label className="wk-label">ふたり目の名前</label>
              <input className="wk-input" value={setupB} onChange={(e) => setSetupB(e.target.value)} placeholder="例：はなこ" />
            </div>
            {error && <div className="wk-error">{error}</div>}
            <button className="wk-btn-primary" style={{ width: '100%', marginTop: 8 }} onClick={() => saveSettings(setupA, setupB, DEFAULT_CATEGORIES)}>
              はじめる
            </button>
          </div>
        </div>
      </div>
    );
  }

  const settleText =
    diff === 0 ? (
      '今月は精算の必要はありません'
    ) : diff > 0 ? (
      <>
        <b className="blue">{settings.personB}</b>さんが <b>{settings.personA}</b>さんに支払う
      </>
    ) : (
      <>
        <b>{settings.personA}</b>さんが <b className="blue">{settings.personB}</b>さんに支払う
      </>
    );

  const weeks = buildCalendarWeeks(calendarMonthKey);
  const eventsByDate = {};
  events.forEach((ev) => {
    (eventsByDate[ev.date] = eventsByDate[ev.date] || []).push(ev);
  });
  const todayString = todayStr();
  const selectedEvents = selectedDate ? events.filter((e) => e.date === selectedDate) : [];

  return (
    <div className="wk-app">
      <style>{css}</style>
      <div className="wk-shell">
        <div className="wk-topbar">
          <div className="wk-logo">
            <span className="wk-logo-badge" />
            わりかん帳
          </div>
        </div>

        {error && <div className="wk-banner">{error}</div>}

        {/* ============ 今月タブ ============ */}
        {activeTab === 'month' && (
          <>
            <div className="wk-monthnav">
              <button className="wk-monthbtn" onClick={() => setMonthKeyState(shiftMonthKey(monthKeyState, -1))}>
                <ChevronLeft size={18} />
              </button>
              <div className="wk-monthlabel">{formatMonthLabel(monthKeyState)}</div>
              <button className="wk-monthbtn" onClick={() => setMonthKeyState(shiftMonthKey(monthKeyState, 1))}>
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="wk-card">
              <div className="wk-settle-toprow">
                <div className="wk-settle-label">今月の精算（支出合計 {formatYen(totalAll)}）</div>
                {settled && (
                  <div className="wk-locked-badge">
                    <Lock size={11} /> 精算済み
                  </div>
                )}
              </div>
              <div className="wk-settle-amount">{diff === 0 ? '¥0' : formatYen(settleAmount)}</div>
              <div className="wk-settle-who">{settleText}</div>
              <div className="wk-stats">
                <div className="wk-stat">
                  <div className="wk-stat-label">合計支出</div>
                  <div className="wk-stat-value">{formatYen(totalAll)}</div>
                </div>
                <div className="wk-stat">
                  <div className="wk-stat-label">{settings.personA}さん</div>
                  <div className="wk-stat-value">{formatYen(paidByA)}</div>
                </div>
                <div className="wk-stat">
                  <div className="wk-stat-label">{settings.personB}さん</div>
                  <div className="wk-stat-value">{formatYen(paidByB)}</div>
                </div>
              </div>
              <button className={`wk-settlebtn ${settled ? 'undo' : 'do'}`} onClick={toggleSettled}>
                {settled ? (
                  <>
                    <Unlock size={14} /> 精算を解除する
                  </>
                ) : (
                  <>
                    <Lock size={14} /> 精算済みにする
                  </>
                )}
              </button>
            </div>

            {monthCategoryRows.length > 0 && (
              <>
                <div className="wk-section-title">カテゴリ別内訳</div>
                <div className="wk-card">
                  {monthCategoryRows.map(([cat, amt]) => (
                    <div className="wk-cat-row" key={cat}>
                      <div className="wk-cat-dot" style={{ background: categoryColor(settings.categories, cat) }}>
                        {cat.slice(0, 1)}
                      </div>
                      <div className="wk-cat-name">{cat}</div>
                      <div className="wk-cat-amount">{formatYen(amt)}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="wk-section-title">支出一覧</div>
            {settled && (
              <div className="wk-lockednotice">
                <Lock size={12} /> 精算済みのため編集・削除はできません
              </div>
            )}
            {expensesLoading ? (
              <div className="wk-empty">読み込み中…</div>
            ) : expenses.length === 0 ? (
              <div className="wk-empty">まだ記録がありません。右下の＋から追加しましょう。</div>
            ) : (
              <div>
                {expenses.map((exp) => (
                  <div className="wk-exp-row" key={exp.id}>
                    <div className="wk-exp-left">
                      <div className="wk-exp-cat">
                        <span className="wk-exp-cat-dot" style={{ background: categoryColor(settings.categories, exp.category) }} />
                        <span className="wk-exp-cat-text">{exp.usage || exp.category}</span>
                      </div>
                      <div className="wk-exp-meta">
                        <div className="wk-exp-date">{formatDateLabel(exp.date)}</div>
                        {exp.memo && <div className="wk-exp-memo">{exp.memo}</div>}
                      </div>
                    </div>
                    <div className="wk-exp-right">
                      <div className="wk-exp-amount">{formatYen(exp.amount)}</div>
                      {!settled && (
                        <>
                          <button className="wk-iconbtn" onClick={() => openEditExpense(exp)}>
                            <Pencil size={14} />
                          </button>
                          <button className="wk-iconbtn" onClick={() => deleteExpense(exp.id)}>
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ============ 統計タブ ============ */}
        {activeTab === 'stats' && (
          <>
            <div className="wk-monthnav">
              <button className="wk-monthbtn" onClick={() => setStatsMonthKey(shiftMonthKey(statsMonthKey, -1))}>
                <ChevronLeft size={18} />
              </button>
              <div className="wk-monthlabel">{formatMonthLabel(statsMonthKey)}</div>
              <button className="wk-monthbtn" onClick={() => setStatsMonthKey(shiftMonthKey(statsMonthKey, 1))}>
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="wk-card">
              <div className="wk-section-title" style={{ margin: 0, display: 'flex', justifyContent: 'space-between' }}>
                <span>カテゴリ別（円グラフ）</span>
                {!statsLoading && pieData.length > 0 && <span>合計 {formatYen(statsTotal)}</span>}
              </div>
              {statsLoading ? (
                <div className="wk-empty">読み込み中…</div>
              ) : pieData.length === 0 ? (
                <div className="wk-empty">この月の支出はありません</div>
              ) : (
                <div className="wk-piewrap">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                        {pieData.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip cursor={false} formatter={(v) => formatYen(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="wk-legend">
                    {pieData.map((d) => (
                      <div className="wk-cat-row" key={d.name}>
                        <div className="wk-cat-dot" style={{ background: d.color }}>
                          {d.name.slice(0, 1)}
                        </div>
                        <div className="wk-cat-name">{d.name}</div>
                        <div className="wk-cat-amount">{formatYen(d.value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="wk-section-title">直近12ヶ月の推移</div>
            <div className="wk-card">
              <div className="wk-monthnav" style={{ marginBottom: 6 }}>
                <button className="wk-monthbtn" onClick={() => setBarEndMonth(shiftMonthKey(barEndMonth, -1))}>
                  <ChevronLeft size={16} />
                </button>
                <div className="wk-monthlabel" style={{ fontSize: 13 }}>
                  {formatMonthShort(shiftMonthKey(barEndMonth, -11))} 〜 {formatMonthShort(barEndMonth)}
                </div>
                <button className="wk-monthbtn" onClick={() => setBarEndMonth(shiftMonthKey(barEndMonth, 1))}>
                  <ChevronRight size={16} />
                </button>
              </div>
              {barLoading ? (
                <div className="wk-empty">読み込み中…</div>
              ) : (
                <div className="wk-barwrap">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E4E7EC" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8A94A6' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#8A94A6' }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => (v >= 10000 ? v / 10000 + '万' : v)} />
                      <Tooltip formatter={(v) => formatYen(v)} />
                      <Bar dataKey="total" fill="#12A870" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}

        {/* ============ 予定表タブ ============ */}
        {activeTab === 'calendar' && (
          <>
            <div className="wk-monthnav">
              <button
                className="wk-monthbtn"
                onClick={() => {
                  setCalendarMonthKey(shiftMonthKey(calendarMonthKey, -1));
                  setSelectedDate(null);
                  setDayPopupMode(null);
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <div className="wk-monthlabel">{formatMonthLabel(calendarMonthKey)}</div>
              <button
                className="wk-monthbtn"
                onClick={() => {
                  setCalendarMonthKey(shiftMonthKey(calendarMonthKey, 1));
                  setSelectedDate(null);
                  setDayPopupMode(null);
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="wk-card">
              <div className="wk-cal-weekdays">
                {['日', '月', '火', '水', '木', '金', '土'].map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </div>
              {eventsLoading ? (
                <div className="wk-empty">読み込み中…</div>
              ) : (
                weeks.map((week, wi) => (
                  <div className="wk-cal-grid" key={wi} style={{ marginBottom: 3 }}>
                    {week.map((date, di) => {
                      if (!date) return <div key={di} className="wk-cal-cell empty" />;
                      const day = parseInt(date.split('-')[2], 10);
                      const dayEvents = eventsByDate[date] || [];
                      return (
                        <button
                          key={di}
                          className={`wk-cal-cell ${date === todayString ? 'today' : ''} ${date === selectedDate ? 'selected' : ''}`}
                          onClick={() => openDay(date)}
                        >
                          <div className="wk-cal-daynum">{day}</div>
                          <div className="wk-cal-events">
                            {dayEvents.slice(0, 2).map((ev, i) => {
                              const color = ev.person === 'A' ? PERSON_COLORS.A : ev.person === 'B' ? PERSON_COLORS.B : PERSON_COLORS.SHARED;
                              const isAllDay = ev.allDay || (!ev.startTime && !ev.endTime);
                              return isAllDay ? (
                                <div key={i} className="wk-cal-chip-allday" style={{ background: color }}>
                                  {ev.title}
                                </div>
                              ) : (
                                <div key={i} className="wk-cal-chip-timed" style={{ color }}>
                                  <span className="wk-cal-chip-dot" style={{ background: color }} />
                                  {ev.title}
                                </div>
                              );
                            })}
                            {dayEvents.length > 2 && <div className="wk-cal-more">+{dayEvents.length - 2}</div>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {/* ============ ToDoタブ ============ */}
        {activeTab === 'todo' && (
          <>
            <div className="wk-card">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="wk-input"
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addTodo();
                  }}
                  placeholder="やることを入力"
                />
                <button className="wk-btn-primary" style={{ flex: '0 0 60px' }} onClick={addTodo}>
                  追加
                </button>
              </div>
            </div>

            {todosLoading ? (
              <div className="wk-empty">読み込み中…</div>
            ) : todos.length === 0 ? (
              <div className="wk-empty">やることはまだありません</div>
            ) : (
              <div className="wk-card">
                {todos
                  .slice()
                  .sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1))
                  .map((t) => (
                    <div className="wk-event-row" key={t.id}>
                      <button
                        className="wk-iconbtn"
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          border: `1.5px solid ${t.done ? 'var(--brand)' : 'var(--line)'}`,
                          background: t.done ? 'var(--brand)' : '#fff',
                          padding: 0,
                          flexShrink: 0,
                        }}
                        onClick={() => toggleTodo(t.id)}
                      >
                        {t.done && <Check size={14} color="#fff" />}
                      </button>
                      <div
                        className="wk-event-title"
                        style={{ color: t.done ? 'var(--ink-soft)' : 'var(--ink)', textDecoration: t.done ? 'line-through' : 'none' }}
                      >
                        {t.text}
                      </div>
                      <button className="wk-iconbtn" onClick={() => deleteTodo(t.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
              </div>
            )}

            <div className="wk-section-title">メモ</div>
            <div className="wk-card">
              {memoLoading ? (
                <div className="wk-empty">読み込み中…</div>
              ) : (
                <textarea
                  className="wk-textarea"
                  value={memoText}
                  onChange={(e) => setMemoText(e.target.value)}
                  placeholder="自由に書き込めるメモ欄です（自動的に保存されます）"
                />
              )}
            </div>
          </>
        )}

        {/* ============ 設定タブ ============ */}
        {activeTab === 'settings' && (
          <>
            <div className="wk-section-title" style={{ marginTop: 4 }}>
              名前
            </div>
            <div className="wk-card">
              <div className="wk-field">
                <label className="wk-label">ひとり目の名前</label>
                <input className="wk-input" value={setupA} onChange={(e) => setSetupA(e.target.value)} />
              </div>
              <div className="wk-field" style={{ marginBottom: 0 }}>
                <label className="wk-label">ふたり目の名前</label>
                <input className="wk-input" value={setupB} onChange={(e) => setSetupB(e.target.value)} />
              </div>
              {error && <div className="wk-error">{error}</div>}
              <button className="wk-btn-primary" style={{ width: '100%', marginTop: 14 }} onClick={() => saveSettings(setupA, setupB, settings.categories)}>
                保存
              </button>
            </div>

            <div className="wk-section-title">カテゴリ</div>
            <div className="wk-card">
              <div className="wk-chips">
                {settings.categories.map((cat) => (
                  <div key={cat} className="wk-chip">
                    {cat}
                    <button className="wk-iconbtn" style={{ padding: 0 }} onClick={() => removeCategory(cat)}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <input className="wk-input" value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} placeholder="新しいカテゴリ名" />
                <button className="wk-btn-primary" style={{ flex: '0 0 60px' }} onClick={addCategory}>
                  追加
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="wk-tabbar">
        {tabs.map((t) => (
          <button key={t.key} className={`wk-tabbtn ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
            <t.icon size={20} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'month' && (
        <button className="wk-fab" onClick={openAddExpense}>
          <Plus size={24} />
        </button>
      )}

      {showAddExpense && (
        <div className="wk-overlay" onClick={() => setShowAddExpense(false)}>
          <div className="wk-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="wk-sheet-header">
              <div className="wk-sheet-title">
                {editingId ? '支出を編集' : '支出を追加'}（{formatMonthLabel(monthKeyState)}）
              </div>
              <button className="wk-iconbtn" onClick={() => setShowAddExpense(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="wk-field">
              <label className="wk-label">日付</label>
              <input type="date" className="wk-input" value={fDate} onChange={(e) => setFDate(e.target.value)} />
            </div>
            <div className="wk-field">
              <label className="wk-label">カテゴリ</label>
              <div className="wk-chips">
                {settings.categories.map((cat) => (
                  <button key={cat} className={`wk-chip ${fCategory === cat ? 'active' : ''}`} onClick={() => setFCategory(cat)}>
                    {cat}
                  </button>
                ))}
                {!showNewCategoryInput && (
                  <button className="wk-chip" onClick={() => setShowNewCategoryInput(true)}>
                    ＋ 追加
                  </button>
                )}
              </div>
              {showNewCategoryInput && (
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input className="wk-input" value={newCategoryInput} onChange={(e) => setNewCategoryInput(e.target.value)} placeholder="新しいカテゴリ名" />
                  <button className="wk-btn-primary" style={{ flex: '0 0 60px' }} onClick={addCategory}>
                    追加
                  </button>
                </div>
              )}
            </div>
            <div className="wk-field">
              <label className="wk-label">用途</label>
              <input className="wk-input" value={fUsage} onChange={(e) => setFUsage(e.target.value)} placeholder="例：スーパーで食材" />
            </div>
            <div className="wk-field">
              <label className="wk-label">金額</label>
              <input type="number" inputMode="numeric" className="wk-input" value={fAmount} onChange={(e) => setFAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="wk-field">
              <label className="wk-label">支払った人</label>
              <div className="wk-payer-toggle">
                <button className={`wk-payer-btn ${fPayer === 'A' ? 'a-active' : ''}`} onClick={() => setFPayer('A')}>
                  {settings.personA}
                </button>
                <button className={`wk-payer-btn ${fPayer === 'B' ? 'b-active' : ''}`} onClick={() => setFPayer('B')}>
                  {settings.personB}
                </button>
              </div>
            </div>
            <div className="wk-field">
              <label className="wk-label">メモ（任意）</label>
              <input className="wk-input" value={fMemo} onChange={(e) => setFMemo(e.target.value)} placeholder="例：スーパーで買い出し" />
            </div>
            {error && <div className="wk-error">{error}</div>}
            <div className="wk-btnrow">
              <button className="wk-btn-secondary" onClick={() => setShowAddExpense(false)}>
                キャンセル
              </button>
              <button className="wk-btn-primary" onClick={submitExpense}>
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {dayPopupMode && selectedDate && (
        <div className="wk-overlay" onClick={closeDayPopup}>
          <div className="wk-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="wk-sheet-header">
              <div className="wk-sheet-title">
                {dayPopupMode === 'form' ? (editingEventId ? '予定を編集' : '予定を追加') : `${formatDateLabel(selectedDate)}の予定`}
              </div>
              <button className="wk-iconbtn" onClick={closeDayPopup}>
                <X size={20} />
              </button>
            </div>

            {dayPopupMode === 'list' ? (
              <>
                {selectedEvents.length === 0 ? (
                  <div className="wk-empty">予定はありません</div>
                ) : (
                  selectedEvents.map((ev) => (
                    <div className="wk-event-row" key={ev.id}>
                      <div
                        className="wk-event-dot"
                        style={{ background: ev.person === 'A' ? PERSON_COLORS.A : ev.person === 'B' ? PERSON_COLORS.B : PERSON_COLORS.SHARED }}
                      />
                      <div className="wk-event-title">
                        {ev.title}
                        {ev.memo && <div className="wk-exp-memo" style={{ maxWidth: 220 }}>{ev.memo}</div>}
                      </div>
                      <div className="wk-event-time">{formatEventTime(ev)}</div>
                      <button className="wk-iconbtn" onClick={() => openEditEvent(ev)}>
                        <Pencil size={13} />
                      </button>
                      <button className="wk-iconbtn" onClick={() => deleteEvent(ev.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
                <button className="wk-addday-btn" onClick={() => openAddEvent(selectedDate)}>
                  ＋ この日に予定を追加
                </button>
              </>
            ) : (
              <>
                <div className="wk-field">
                  <label className="wk-label">タイトル</label>
                  <input className="wk-input" value={eTitle} onChange={(e) => setETitle(e.target.value)} placeholder="例：歯医者" />
                </div>
                <div className="wk-field">
                  <label className="wk-label">日付</label>
                  <input type="date" className="wk-input" value={eDate} onChange={(e) => setEDate(e.target.value)} />
                </div>
                <div className="wk-field">
                  <label className="wk-label">時間</label>
                  <div className="wk-chips" style={{ marginBottom: eAllDay ? 0 : 10 }}>
                    <button className={`wk-chip ${eAllDay ? 'active' : ''}`} onClick={() => setEAllDay(true)}>
                      終日
                    </button>
                    <button className={`wk-chip ${!eAllDay ? 'active' : ''}`} onClick={() => setEAllDay(false)}>
                      時間を指定
                    </button>
                  </div>
                  {!eAllDay && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input type="time" className="wk-input" value={eStartTime} onChange={(e) => setEStartTime(e.target.value)} />
                      <span style={{ color: 'var(--ink-soft)', fontSize: 13 }}>〜</span>
                      <input type="time" className="wk-input" value={eEndTime} onChange={(e) => setEEndTime(e.target.value)} />
                    </div>
                  )}
                </div>
                <div className="wk-field">
                  <label className="wk-label">担当</label>
                  <div className="wk-payer-toggle">
                    <button className={`wk-payer-btn ${ePerson === 'A' ? 'a-active' : ''}`} onClick={() => setEPerson('A')}>
                      {settings.personA}
                    </button>
                    <button className={`wk-payer-btn ${ePerson === 'B' ? 'b-active' : ''}`} onClick={() => setEPerson('B')}>
                      {settings.personB}
                    </button>
                    <button className={`wk-payer-btn ${ePerson === 'SHARED' ? 's-active' : ''}`} onClick={() => setEPerson('SHARED')}>
                      2人共通
                    </button>
                  </div>
                </div>
                <div className="wk-field">
                  <label className="wk-label">メモ（任意）</label>
                  <input className="wk-input" value={eMemo} onChange={(e) => setEMemo(e.target.value)} />
                </div>
                {error && <div className="wk-error">{error}</div>}
                <div className="wk-btnrow">
                  <button className="wk-btn-secondary" onClick={() => setDayPopupMode('list')}>
                    キャンセル
                  </button>
                  <button className="wk-btn-primary" onClick={submitEvent}>
                    保存
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
