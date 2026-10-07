import classImages from '../../assets/class-images.png'
import { classImageIndex } from '../../model/classIcons'
import type { StudioExplorerRow } from '../../model/studioExplorerSnapshot'

const WIDTH = 340
const HEADER = 30
const SEARCH = 28
const ROW = 22
export const EXPLORER_SNAPSHOT_SCALE = 2
const SCALE = EXPLORER_SNAPSHOT_SCALE
const ICON_SIZE = 16

export async function renderStudioExplorerSnapshot(
  rows: StudioExplorerRow[],
  options: { title?: string } = {},
): Promise<HTMLCanvasElement> {
  const chrome = Boolean(options.title)
  const top = chrome ? HEADER + SEARCH : 4
  const height = top + rows.length * ROW + 4
  const width = chrome ? WIDTH : selectionWidth(rows)
  const canvas = document.createElement('canvas')
  canvas.width = width * SCALE
  canvas.height = height * SCALE
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  const icons = await loadImage(classImages)
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#17191f'
  ctx.fillRect(0, 0, width, height)

  if (options.title) {
    drawHeader(ctx, options.title)
    drawSearch(ctx)
  }

  let y = top
  for (const row of rows) {
    drawGuideLines(ctx, row.depth, y)
    const indent = 8 + row.depth * 18
    if (row.hasChildren) drawArrow(ctx, indent, y + ROW / 2)
    const iconX = indent + 13
    const sourceX = classImageIndex(row.className) * ICON_SIZE
    ctx.drawImage(icons, sourceX, 0, ICON_SIZE, ICON_SIZE, iconX, y + 3, ICON_SIZE, ICON_SIZE)
    ctx.fillStyle = '#d5d7de'
    ctx.font = '13px Inter, "Segoe UI", sans-serif'
    ctx.fillText(fitText(ctx, row.name, width - iconX - 16), iconX + 21, y + ROW / 2)
    y += ROW
  }

  ctx.strokeStyle = '#0d0f13'
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1)
  return canvas
}

function selectionWidth(rows: StudioExplorerRow[]): number {
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) return WIDTH
  measure.font = '13px Inter, "Segoe UI", sans-serif'
  const widest = rows.reduce((max, row) => {
    const indent = 8 + row.depth * 18
    return Math.max(max, indent + 50 + measure.measureText(row.name).width)
  }, 96)
  return Math.ceil(widest + 12)
}

function drawHeader(ctx: CanvasRenderingContext2D, title: string) {
  ctx.fillStyle = '#202329'
  ctx.fillRect(0, 0, WIDTH, HEADER)
  ctx.fillStyle = '#e4e5e9'
  ctx.font = '13px Inter, "Segoe UI", sans-serif'
  ctx.fillText(title, 10, HEADER / 2)

  ctx.strokeStyle = '#b6b9c2'
  ctx.lineWidth = 1.2
  const pinX = WIDTH - 31
  ctx.beginPath()
  ctx.arc(pinX, 11, 3, 0, Math.PI * 2)
  ctx.moveTo(pinX, 14)
  ctx.lineTo(pinX, 21)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(WIDTH - 15, 11)
  ctx.lineTo(WIDTH - 9, 17)
  ctx.moveTo(WIDTH - 9, 11)
  ctx.lineTo(WIDTH - 15, 17)
  ctx.stroke()
  ctx.lineWidth = 1
}

function drawSearch(ctx: CanvasRenderingContext2D) {
  const y = HEADER + 4
  ctx.fillStyle = '#2a2d34'
  ctx.fillRect(4, y, WIDTH - 36, SEARCH - 8)
  ctx.fillStyle = '#9296a0'
  ctx.font = '12px Inter, "Segoe UI", sans-serif'
  ctx.fillText('Search', 10, y + (SEARCH - 8) / 2)

  ctx.strokeStyle = '#c0c3ca'
  ctx.beginPath()
  ctx.arc(WIDTH - 49, y + 10, 6, -0.6, Math.PI * 1.4)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(WIDTH - 55, y + 4)
  ctx.lineTo(WIDTH - 55, y + 9)
  ctx.lineTo(WIDTH - 50, y + 9)
  ctx.stroke()

  ctx.fillStyle = '#30333a'
  ctx.beginPath()
  ctx.roundRect(WIDTH - 27, y, 23, SEARCH - 8, 5)
  ctx.fill()
  ctx.fillStyle = '#d6d8de'
  for (let x = WIDTH - 20; x <= WIDTH - 12; x += 4) {
    ctx.beginPath()
    ctx.arc(x, y + 10, 1.2, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawGuideLines(ctx: CanvasRenderingContext2D, depth: number, y: number) {
  ctx.strokeStyle = '#292c33'
  ctx.lineWidth = 1
  for (let level = 1; level <= depth; level += 1) {
    const x = 8 + (level - 1) * 18 + 4.5
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x, y + ROW)
    ctx.stroke()
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#d3d5dc'
  ctx.beginPath()
  ctx.moveTo(x, y - 2)
  ctx.lineTo(x + 7, y - 2)
  ctx.lineTo(x + 3.5, y + 2)
  ctx.fill()
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Could not load Studio class icons.'))
    image.src = src
  })
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let trimmed = text
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) trimmed = trimmed.slice(0, -1)
  return `${trimmed}…`
}
