export async function copyPngDataUrl(dataUrl: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob()
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    throw new Error('Copy is not available in this browser.')
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
}
