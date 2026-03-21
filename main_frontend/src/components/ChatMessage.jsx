export default function ChatMessage({ message }) {
  const isBot = message.sender === 'bot';

  if (message.type === 'typing') {
    return (
      <div className="flex gap-3 mb-4">
        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-sm" style={{ background: 'var(--color-primary)' }}>
          H
        </div>
        <div className="rounded-[4px_16px_16px_16px] px-4 py-3 bg-surface-2 border border-border">
          <div className="flex gap-1 items-center h-5">
            <span className="bounce-dot" />
            <span className="bounce-dot" />
            <span className="bounce-dot" />
          </div>
        </div>
      </div>
    );
  }

  if (isBot) {
    return (
      <div className="flex gap-3 mb-4 max-w-[85%]">
        <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-sm" style={{ background: 'var(--color-primary)' }}>
          H
        </div>
        <div>
          <div
            className="rounded-[4px_16px_16px_16px] px-4 py-3 text-base leading-relaxed bg-surface-2 border border-border text-text-primary"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {message.text}
          </div>
          {message.options && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => opt.onClick?.()}
                  disabled={message.answered}
                  className={`px-5 py-2.5 rounded-full border text-[15px] min-h-[48px] transition-all ${
                    message.selectedOption === opt.label
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface border-border text-text-primary hover:border-primary'
                  } ${message.answered ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          {message.showSkip && !message.answered && (
            <div className="mt-2">
              <div className="flex items-center gap-2 my-2 text-text-hint text-sm">
                <span className="flex-1 h-px bg-border" />
                <span>{message.orText || 'or type'}</span>
                <span className="flex-1 h-px bg-border" />
              </div>
              <button
                onClick={() => message.onSkip?.()}
                className="text-text-hint text-sm hover:text-primary transition-colors min-h-[48px] px-2"
              >
                {message.skipText || 'Skip this question'}
              </button>
            </div>
          )}
          {message.component}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-end mb-4">
      <div
        className="rounded-[16px_4px_16px_16px] px-4 py-3 text-base leading-relaxed max-w-[85%] text-white"
        style={{ background: 'var(--color-primary)', whiteSpace: 'pre-wrap' }}
      >
        {message.text}
      </div>
    </div>
  );
}
