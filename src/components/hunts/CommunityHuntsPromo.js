import { ArrowUpRight } from 'lucide-react';

// The one place communityhunts.gg branding appears: its wordmark. Everything
// else stays in this site's own slate/mono language (PRODUCT.md: no casino
// gold). Always renders, even when hunt data is down.
export default function CommunityHuntsPromo() {
  const linkCls =
    'inline-flex items-center gap-1.5 px-3 py-2 border border-white/15 text-white/75 hover:text-white-body hover:border-emerald-signal/50 transition-colors duration-150 text-[0.625rem] font-bold tracking-eyebrow-lg uppercase font-mono';
  return (
    <section className="border border-white/8 bg-zinc-card/30 px-4 sm:px-6 py-5" aria-label="communityhunts.gg">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <img src="/brand/communityhunts-logo.png" alt="communityhunts.gg" width="600" height="121" className="h-7 w-auto self-start" />
        <p className="text-sm text-white/70 leading-relaxed flex-1">
          Every hunt on this channel runs on communityhunts.gg. Call a slot in chat and watch your cut open live.
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="https://communityhunts.gg/bean" target="_blank" rel="noopener noreferrer" className={linkCls}>
            Watch the hub <ArrowUpRight size={12} aria-hidden="true" />
          </a>
          <a href="https://communityhunts.gg/add-community" target="_blank" rel="noopener noreferrer" className={linkCls}>
            Bring your community <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        </div>
      </div>
    </section>
  );
}
