import { QRCodeSVG } from 'qrcode.react'

/** QR code for the current deployment. Generated from window.location, so it
 *  always points at whatever domain the page is served from. */
export function QrBadge({ size = 180, label = true }: { size?: number; label?: boolean }) {
  const url = `${window.location.origin}/`
  return (
    <div className="inline-flex flex-col items-center gap-3">
      <div className="bg-paper p-3">
        <QRCodeSVG value={url} size={size} bgColor="#f2eee6" fgColor="#0b1c2c" level="M" />
      </div>
      {label && <span className="font-mono text-xs text-paper-dim break-all text-center">{url.replace(/^https?:\/\//, '')}</span>}
    </div>
  )
}
