import type { StudioPropertyRow } from '../../model/studioPropertySnapshot'

const WIDTH = 400
const HEADER = 34
const FILTER = 30
const CATEGORY = 26
const ROW = 22
const SCALE = 2

const COLOR = {
  bg: '#1c1c1c',
  header: '#2a2a2a',
  headerLine: '#111111',
  title: '#e8e8e8',
  muted: '#8d8d8d',
  category: '#303030',
  categoryText: '#d6d6d6',
  name: '#d0d0d0',
  value: '#c4c4c4',
  arrow: '#bdbdbd',
  check: '#dedede',
  icon: '#9a9a9a',
}

export function renderStudioPropertySnapshot(title: string, rows: StudioPropertyRow[]): HTMLCanvasElement {
  const height = HEADER + FILTER + rows.reduce((sum, row) => sum + (row.kind === 'category' ? CATEGORY : ROW), 0) + 8
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH * SCALE
  canvas.height = height * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(SCALE, SCALE)
  ctx.font = '13px Inter, "Segoe UI", sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = COLOR.bg
  ctx.fillRect(0, 0, WIDTH, height)

  ctx.fillStyle = COLOR.header
  ctx.fillRect(0, 0, WIDTH, HEADER)
  ctx.fillStyle = COLOR.title
  ctx.font = '600 13px Inter, "Segoe UI", sans-serif'
  const titleWidth = ctx.measureText(title).width
  ctx.fillText(fitText(ctx, title, WIDTH - 56), Math.max(12, (WIDTH - Math.min(titleWidth, WIDTH - 56)) / 2), HEADER / 2)
  drawHeaderIcons(ctx)
  ctx.fillStyle = COLOR.headerLine
  ctx.fillRect(0, HEADER - 1, WIDTH, 1)

  ctx.font = '13px Inter, "Segoe UI", sans-serif'
  ctx.fillStyle = COLOR.muted
  drawSearchIcon(ctx, 12, HEADER + FILTER / 2)
  ctx.fillText('Filter Properties', 32, HEADER + FILTER / 2)
  ctx.fillStyle = '#2a2a2a'
  ctx.fillRect(0, HEADER + FILTER - 1, WIDTH, 1)

  let y = HEADER + FILTER
  for (const row of rows) {
    if (row.kind === 'category') {
      ctx.fillStyle = COLOR.category
      ctx.fillRect(0, y, WIDTH, CATEGORY)
      ctx.fillStyle = COLOR.arrow
      drawArrow(ctx, 12, y + 10, 'down')
      ctx.fillStyle = COLOR.categoryText
      ctx.font = '600 13px Inter, "Segoe UI", sans-serif'
      ctx.fillText(row.label, 28, y + CATEGORY / 2)
      y += CATEGORY
      continue
    }
    const rowHeight = ROW
    ctx.font = '13px Inter, "Segoe UI", sans-serif'
    const indent = 8 + row.depth * 16
    if (row.arrow !== 'none') {
      ctx.fillStyle = COLOR.arrow
      drawArrow(ctx, indent + 4, y + 8, row.arrow)
    }
    ctx.fillStyle = COLOR.name
    const nameX = indent + (row.arrow === 'none' ? 4 : 18)
    const valueX = 196
    ctx.fillText(fitText(ctx, row.label, valueX - nameX - 8), nameX, y + rowHeight / 2)
    drawValue(ctx, row, valueX, y, rowHeight)
    y += rowHeight
  }
  ctx.strokeStyle = '#111111'
  ctx.strokeRect(0.5, 0.5, WIDTH - 1, height - 1)
  return canvas
}

function drawValue(ctx: CanvasRenderingContext2D, row: StudioPropertyRow, x: number, y: number, height: number) {
  const value = row.value
  const maxWidth = WIDTH - x - 12
  if (value.type === 'check') {
    const box = 13
    const top = y + (height - box) / 2
    ctx.strokeStyle = '#8f8f8f'
    ctx.strokeRect(x + 0.5, top + 0.5, box, box)
    if (value.checked) {
      ctx.strokeStyle = COLOR.check
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.moveTo(x + 3, top + 7)
      ctx.lineTo(x + 6, top + 10)
      ctx.lineTo(x + 11, top + 3)
      ctx.stroke()
      ctx.lineWidth = 1
    }
    return
  }
  if (value.type === 'color') {
    const box = 13
    const top = y + (height - box) / 2
    ctx.fillStyle = value.hex
    ctx.fillRect(x, top, box, box)
    ctx.strokeStyle = '#666'
    ctx.strokeRect(x + 0.5, top + 0.5, box, box)
    ctx.fillStyle = COLOR.value
    ctx.fillText(fitText(ctx, value.text, maxWidth - 18), x + 18, y + height / 2)
    return
  }
  if (value.type !== 'text' || !value.text) return
  ctx.fillStyle = COLOR.value
  const link = /^(https?:|rbxasset)/.test(value.text)
  const textWidth = link ? maxWidth - 16 : maxWidth
  const shown = fitText(ctx, value.text, textWidth)
  ctx.fillText(shown, x, y + height / 2)
  if (link) drawLinkIcon(ctx, x + ctx.measureText(shown).width + 6, y + height / 2)
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, direction: 'down' | 'right') {
  ctx.beginPath()
  if (direction === 'down') {
    ctx.moveTo(x, y)
    ctx.lineTo(x + 8, y)
    ctx.lineTo(x + 4, y + 5)
  } else {
    ctx.moveTo(x, y)
    ctx.lineTo(x + 5, y + 4)
    ctx.lineTo(x, y + 8)
  }
  ctx.fill()
}

function drawSearchIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = COLOR.icon
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(x + 5, y - 1, 4, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + 8, y + 2)
  ctx.lineTo(x + 11, y + 5)
  ctx.stroke()
  ctx.lineWidth = 1
}

function drawLinkIcon(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = COLOR.icon
  ctx.strokeRect(x + 0.5, y - 4.5, 7, 7)
  ctx.beginPath()
  ctx.moveTo(x + 3, y - 1)
  ctx.lineTo(x + 8, y - 6)
  ctx.moveTo(x + 5, y - 6)
  ctx.lineTo(x + 8, y - 6)
  ctx.lineTo(x + 8, y - 3)
  ctx.stroke()
}

function drawHeaderIcons(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = COLOR.muted
  ctx.lineWidth = 1.2
  const pinX = WIDTH - 42
  const pinY = HEADER / 2
  ctx.beginPath()
  ctx.arc(pinX, pinY - 2, 3, 0, Math.PI * 2)
  ctx.moveTo(pinX, pinY + 1)
  ctx.lineTo(pinX, pinY + 7)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(WIDTH - 20, pinY - 4)
  ctx.lineTo(WIDTH - 12, pinY + 4)
  ctx.moveTo(WIDTH - 12, pinY - 4)
  ctx.lineTo(WIDTH - 20, pinY + 4)
  ctx.stroke()
  ctx.lineWidth = 1
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let trimmed = text
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) trimmed = trimmed.slice(0, -1)
  return `${trimmed}…`
}
