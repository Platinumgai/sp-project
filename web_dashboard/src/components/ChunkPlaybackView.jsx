import { useEffect, useMemo, useRef, useState } from 'react'
import { chunkStreamUrl } from '../api/recordings'

// Plays a recording's uploaded chunks back-to-back, in chunk_number order.
// There is no server-side concatenation of chunks into one continuous file
// (see recordings.py::stream_chunk's docstring for why) -- each chunk is an
// independent segment file, so this advances to the next one's <video src>
// automatically when the current one ends, which is a correct and simple
// way to watch a full recording without an ffmpeg-class remux step on the
// backend. A missing chunk_number in the sequence is skipped over (shown in
// the strip below as unavailable) rather than breaking playback.
export default function ChunkPlaybackView({ recordingId, chunks }) {
  const videoRef = useRef(null)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  const available = useMemo(
    () => [...chunks].filter((c) => c.upload_status === 'uploaded').sort((a, b) => a.chunk_number - b.chunk_number),
    [chunks],
  )
  const current = available[index]

  useEffect(() => {
    // A recording that gained more chunks since last render (e.g. still
    // uploading) shouldn't reset an in-progress playback position.
    if (index >= available.length) setIndex(0)
  }, [available.length, index])

  if (available.length === 0) {
    return <p className="text-sm text-ink-300">No uploaded chunks available to play yet.</p>
  }

  function handleEnded() {
    if (index < available.length - 1) {
      setIndex(index + 1)
    } else {
      setPlaying(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-base-700 bg-black">
        <video
          ref={videoRef}
          key={current.chunk_number}
          src={chunkStreamUrl(recordingId, current.chunk_number)}
          controls
          autoPlay={playing}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={handleEnded}
          className="aspect-video w-full bg-black"
        />
      </div>
      <div className="flex items-center justify-between text-xs text-ink-500">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="rounded-md bg-base-700 px-2 py-1 text-ink-100 hover:bg-base-600 disabled:opacity-40"
        >
          ← Previous
        </button>
        <span>
          Chunk {current.chunk_number} ({index + 1} of {available.length}){current.is_last_chunk ? ' · last chunk' : ''}
        </span>
        <button
          onClick={() => setIndex((i) => Math.min(available.length - 1, i + 1))}
          disabled={index === available.length - 1}
          className="rounded-md bg-base-700 px-2 py-1 text-ink-100 hover:bg-base-600 disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  )
}
