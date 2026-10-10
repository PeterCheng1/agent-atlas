import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type Filter = 'all' | 'active' | 'completed'

interface Todo {
  id: string
  text: string
  completed: boolean
  createdAt: number
}

const STORAGE_KEY = 'react-todo-app-todos'

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const loadTodos = (): Todo[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map((item) => ({
        id: typeof item.id === 'string' ? item.id : createId(),
        text: typeof item.text === 'string' ? item.text : '',
        completed: Boolean(item.completed),
        createdAt: typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
      }))
      .filter((item) => item.text.length > 0)
  } catch (error) {
    console.warn('读取本地数据失败:', error)
    return []
  }
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'completed', label: '已完成' },
]

function App() {
  const [todos, setTodos] = useState<Todo[]>(loadTodos)
  const [input, setInput] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [leavingIds, setLeavingIds] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
  }, [todos])

  const stats = useMemo(() => {
    const total = todos.length
    const completed = todos.filter((todo) => todo.completed).length
    const active = total - completed
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100)
    return { total, completed, active, percent }
  }, [todos])

  const visibleTodos = useMemo(() => {
    if (filter === 'active') return todos.filter((todo) => !todo.completed)
    if (filter === 'completed') return todos.filter((todo) => todo.completed)
    return todos
  }, [todos, filter])

  const addTodo = () => {
    const text = input.trim()
    if (!text) {
      inputRef.current?.focus()
      return
    }
    setTodos((prev) => [
      { id: createId(), text, completed: false, createdAt: Date.now() },
      ...prev,
    ])
    setInput('')
    inputRef.current?.focus()
  }

  const animateRemove = (ids: string[], commit: () => void) => {
    setLeavingIds((prev) => [...prev, ...ids])
    window.setTimeout(() => {
      commit()
      setLeavingIds((prev) => prev.filter((id) => !ids.includes(id)))
    }, 260)
  }

  const removeTodo = (id: string) => {
    animateRemove([id], () => {
      setTodos((prev) => prev.filter((todo) => todo.id !== id))
    })
  }

  const clearCompleted = () => {
    const ids = todos.filter((todo) => todo.completed).map((todo) => todo.id)
    if (ids.length === 0) return
    animateRemove(ids, () => {
      setTodos((prev) => prev.filter((todo) => !todo.completed))
    })
  }

  const toggleTodo = (id: string) => {
    setTodos((prev) =>
      prev.map((todo) => (todo.id === id ? { ...todo, completed: !todo.completed } : todo)),
    )
  }

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id)
    setEditingText(todo.text)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingText('')
  }

  const saveEdit = () => {
    if (editingId === null) return
    const text = editingText.trim()
    if (!text) {
      removeTodo(editingId)
      cancelEdit()
      return
    }
    setTodos((prev) =>
      prev.map((todo) => (todo.id === editingId ? { ...todo, text } : todo)),
    )
    cancelEdit()
  }

  return (
    <div className="app">
      <div className="card">
        <header className="card__header">
          <h1 className="title">Todo List</h1>
          <p className="subtitle">记录待办 · 高效每一天</p>
        </header>

        <div className="composer">
          <input
            ref={inputRef}
            className="composer__input"
            value={input}
            placeholder="今天要做点什么？"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') addTodo()
            }}
          />
          <button className="btn btn--primary" onClick={addTodo}>
            添加
          </button>
        </div>

        <section className="stats">
          <div className="stats__item">
            <span className="stats__value">{stats.total}</span>
            <span className="stats__label">总数</span>
          </div>
          <div className="stats__item">
            <span className="stats__value">{stats.active}</span>
            <span className="stats__label">进行中</span>
          </div>
          <div className="stats__item">
            <span className="stats__value">{stats.completed}</span>
            <span className="stats__label">已完成</span>
          </div>
          <div className="stats__item">
            <span className="stats__value">{stats.percent}%</span>
            <span className="stats__label">完成度</span>
          </div>
          <div className="progress">
            <div className="progress__bar" style={{ width: `${stats.percent}%` }} />
          </div>
        </section>

        <nav className="filters">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              className={`filter ${filter === item.key ? 'filter--active' : ''}`}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <ul className="todo-list">
          {visibleTodos.map((todo) => {
            const isLeaving = leavingIds.includes(todo.id)
            return (
              <li
                key={todo.id}
                className={`todo ${todo.completed ? 'todo--done' : ''} ${
                  isLeaving ? 'todo--leaving' : 'todo--entering'
                }`}
              >
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => toggleTodo(todo.id)}
                  />
                  <span className="checkbox__mark" />
                </label>

                {editingId === todo.id ? (
                  <input
                    className="todo__edit"
                    autoFocus
                    value={editingText}
                    onChange={(event) => setEditingText(event.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') saveEdit()
                      if (event.key === 'Escape') cancelEdit()
                    }}
                  />
                ) : (
                  <span className="todo__text" onDoubleClick={() => startEdit(todo)}>
                    {todo.text}
                  </span>
                )}

                <div className="todo__actions">
                  {editingId === todo.id ? (
                    <>
                      <button className="icon-btn" title="保存" onClick={saveEdit}>
                        ✓
                      </button>
                      <button className="icon-btn" title="取消" onClick={cancelEdit}>
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="icon-btn" title="编辑" onClick={() => startEdit(todo)}>
                        ✎
                      </button>
                      <button
                        className="icon-btn icon-btn--danger"
                        title="删除"
                        onClick={() => removeTodo(todo.id)}
                      >
                        🗑
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        {visibleTodos.length === 0 && (
          <p className="empty">
            {filter === 'completed'
              ? '还没有已完成的任务'
              : filter === 'active'
                ? '太棒了，没有进行中的任务'
                : '暂无待办，先添加一个吧'}
          </p>
        )}

        <footer className="card__footer">
          <span className="hint">双击文字可快速编辑</span>
          {stats.completed > 0 && (
            <button className="btn btn--ghost" onClick={clearCompleted}>
              清除已完成
            </button>
          )}
        </footer>
      </div>
    </div>
  )
}

export default App
