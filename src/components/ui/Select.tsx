'use client'

import { Children, isValidElement, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, ReactElement, ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Substituto direto do <select> nativo, com pesquisa: escreve-se no campo e a lista
 * vai filtrando (ignora maiúsculas e acentos). Usa-se igual — `value`, `onChange(e)`
 * com `e.target.value`, `<option>` como filhos, `name`/`required`/`disabled` — por isso
 * trocar `<select>` por `<Select>` não obriga a mexer no resto do código.
 *
 * As opções aparecem por ordem alfabética (números por ordem numérica), com a opção
 * vazia ("Todos…", "-- Selecionar --") e as de "todos/vários" sempre no topo.
 * `sort={false}` mantém a ordem original — para meses, anos, períodos e afins.
 */

type Opt = { value: string; label: string; disabled: boolean }

type SelectProps = {
  value?: string | number | readonly string[]
  defaultValue?: string | number | readonly string[]
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void
  name?: string
  id?: string
  required?: boolean
  disabled?: boolean
  className?: string
  style?: CSSProperties
  title?: string
  autoFocus?: boolean
  'aria-label'?: string
  children?: ReactNode
  /** false = manter a ordem em que as opções foram escritas. */
  sort?: boolean
}

const PINNED_VALUES = new Set(['', 'all', 'todos', 'todas', '__all__', 'varios'])

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function textOf(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children)
  return ''
}

function collectOptions(children: ReactNode, out: Opt[] = []): Opt[] {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return
    const el = child as ReactElement<{ value?: unknown; children?: ReactNode; disabled?: boolean }>
    if (el.type === 'option') {
      const label = textOf(el.props.children).replace(/\s+/g, ' ').trim()
      out.push({ value: el.props.value !== undefined ? String(el.props.value) : label, label, disabled: Boolean(el.props.disabled) })
    } else if (el.props.children) {
      collectOptions(el.props.children, out) // fragments / optgroup
    }
  })
  return out
}

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`

export default function Select({
  value, defaultValue, onChange, name, id, required, disabled, className, style, title, autoFocus,
  'aria-label': ariaLabel, children, sort = true,
}: SelectProps) {
  const rawOptions = useMemo(() => collectOptions(children), [children])
  const options = useMemo(() => {
    if (!sort) return rawOptions
    const pinned = rawOptions.filter((o) => PINNED_VALUES.has(o.value.toLowerCase()))
    const rest = rawOptions
      .filter((o) => !PINNED_VALUES.has(o.value.toLowerCase()))
      .sort((a, b) => a.label.localeCompare(b.label, 'pt', { numeric: true, sensitivity: 'base' }))
    return [...pinned, ...rest]
  }, [rawOptions, sort])

  // Como no <select> nativo: sem value nem defaultValue fica escolhida a primeira opção.
  const isControlled = value !== undefined
  const [inner, setInner] = useState(() => String(defaultValue ?? rawOptions[0]?.value ?? ''))
  const current = isControlled ? String(value ?? '') : inner

  const selected = options.find((o) => o.value === current)
  const emptyLabel = options.find((o) => o.value === '')?.label ?? ''
  const shownLabel = current === '' ? '' : (selected?.label ?? current)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const filtered = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean)
    if (words.length === 0) return options
    return options.filter((o) => { const l = fold(o.label); return words.every((w) => l.includes(w)) })
  }, [options, query])

  function place() {
    const el = inputRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const below = window.innerHeight - r.bottom - 8
    const above = r.top - 8
    const width = Math.max(r.width, 200)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8))
    if (below < 220 && above > below) setPos({ left, width, bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(320, above) })
    else setPos({ left, width, top: r.bottom + 4, maxHeight: Math.min(320, below) })
  }

  useLayoutEffect(() => {
    if (!open) return
    place()
    const onMove = () => place()
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => { window.removeEventListener('resize', onMove); window.removeEventListener('scroll', onMove, true) }
  }, [open])

  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function openList() {
    if (disabled || open) return
    setQuery('')
    const idx = options.findIndex((o) => o.value === current)
    setActive(idx >= 0 ? idx : 0)
    setOpen(true)
  }

  function choose(opt: Opt) {
    if (opt.disabled) return
    setOpen(false)
    setQuery('')
    if (opt.value === current) return
    if (!isControlled) setInner(opt.value)
    const target = { value: opt.value, name: name ?? '', id: id ?? '' }
    onChange?.({ target, currentTarget: target } as unknown as ChangeEvent<HTMLSelectElement>)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openList() }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(filtered.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) choose(filtered[active]) }
    else if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false); setQuery('') }
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={current} />}
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        title={title ?? (shownLabel || emptyLabel || undefined)}
        // Largura natural como a do <select> (cabe a opção mais comprida); classes w-* sobrepõem-se.
        size={Math.min(40, Math.max(4, ...options.map((o) => o.label.length)))}
        disabled={disabled}
        required={required}
        className={`${className ?? ''} cursor-pointer text-ellipsis`}
        style={{ backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.5rem center', backgroundSize: '1rem', paddingRight: '1.75rem', ...style }}
        value={open ? query : shownLabel}
        placeholder={open ? (shownLabel || emptyLabel || 'Escrever para filtrar…') : emptyLabel}
        onChange={(e) => { setQuery(e.target.value); setActive(0); if (!open) setOpen(true) }}
        onMouseDown={() => { if (document.activeElement === inputRef.current) openList() }}
        onFocus={openList}
        onBlur={() => { setOpen(false); setQuery('') }}
        onKeyDown={onKeyDown}
      />
      {open && pos && createPortal(
        <ul
          ref={listRef}
          role="listbox"
          // Marcador para popovers com "clicar fora fecha" (ex. ExcelDateFilter): esta lista
          // vive em document.body, fora deles, e o clique numa opção fechava-os antes de contar.
          data-select-list=""
          className="fixed z-[1000] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl py-1 text-xs"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          onMouseDown={(e) => e.preventDefault() /* não tirar o foco ao campo */}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-slate-400 italic">Sem resultados</li>
          ) : filtered.map((o, i) => (
            <li
              key={`${o.value}-${i}`}
              data-idx={i}
              role="option"
              aria-selected={o.value === current}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o)}
              className={`px-3 py-1.5 cursor-pointer ${o.disabled ? 'opacity-40 cursor-not-allowed' : ''} ${
                i === active ? 'bg-industrial-blue text-white' : o.value === current ? 'bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200'
              } ${o.value === '' ? 'italic' : ''}`}
            >
              {o.label || ' '}
            </li>
          ))}
        </ul>,
        document.body
      )}
    </>
  )
}
