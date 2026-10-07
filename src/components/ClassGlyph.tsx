import classImages from '../assets/class-images.png'
import { CLASS_IMAGE_COUNT, classImageIndex } from '../model/classIcons'

export function ClassGlyph({ className, size = 16 }: { className: string; size?: number }) {
  const index = classImageIndex(className)
  return (
    <span
      className="class-glyph"
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${classImages})`,
        backgroundPosition: `-${index * size}px 0`,
        backgroundSize: `${CLASS_IMAGE_COUNT * size}px ${size}px`,
      }}
    />
  )
}
