// Every icon in the app comes from Phosphor (MIT), drawn at the size and colour of the text around it.
// Objects are solid ("fill"), which suits the flat blocks of the UI; arrows, ticks and other line glyphs are "bold".
import { ArrowDown, ArrowLeft, ArrowUp,ChatCircle, PaperPlaneRight, ArrowRight, ArrowUpRight, Books, Broadcast, CalendarBlank, CaretDown, CaretLeft, CaretRight, ChartBar, Check, CircleNotch, DotsThree, GearSix, Heart, MagnifyingGlass, MusicNotes, Pause, Play, Plus, ShieldCheck, SignOut, SkipBack, SkipForward, Sparkle, Star, Tray, TrendDown, TrendUp, User, VinylRecord, X, XCircle, type Icon } from "@phosphor-icons/react";

const mk = (C: Icon, solid = false) => () => <C className="ico" aria-hidden weight={solid ? "fill" : "bold"} />;
export const Ico = {
  Left: mk(ArrowLeft), Right: mk(ArrowRight), External: mk(ArrowUpRight), Check: mk(Check), Search: mk(MagnifyingGlass), XCircle: mk(XCircle, true), Chevron: mk(CaretRight), ChevLeft: mk(CaretLeft), ChevDown: mk(CaretDown), Calendar: mk(CalendarBlank, true), Music: mk(MusicNotes, true), Star: mk(Star, true), Disc: mk(VinylRecord, true), Plus: mk(Plus), X: mk(X),
  Play: mk(Play, true), Pause: mk(Pause, true), Prev: mk(SkipBack, true), Next: mk(SkipForward, true),
  Up: mk(TrendUp), Down: mk(TrendDown),
  User: mk(User, true), Library: mk(Books, true), Reports: mk(ChartBar, true), Recommended: mk(Sparkle, true), Inbox: mk(Tray, true), Scrobble: mk(Broadcast, true), Settings: mk(GearSix, true), LogOut: mk(SignOut), More: mk(DotsThree), Shield: mk(ShieldCheck, true), Chat: mk(ChatCircle, true), Send: mk(PaperPlaneRight, true),
  SortUp: mk(ArrowUp), SortDown: mk(ArrowDown),
  Heart: ({ on }: { on?: boolean }) => <Heart className="ico" aria-hidden weight={on ? "fill" : "bold"} />,
};
/** An arrow between two words, as in "Settings > Applications" or "old > new". Screen readers hear `say`. */
export const Arrow = ({ say = "to" }: { say?: string }) => <span className="arrow"><ArrowRight className="ico" aria-hidden weight="bold" /><span className="sr">{say}</span></span>;
const SEP = " \u2192 ";
/** Text with arrows in it (as staff action labels store renames and merges), the arrows drawn as icons. */
export const arrowed = (s: string | null) => !s ? s : s.includes(SEP) ? s.split(SEP).flatMap((p, i) => i ? [<Arrow key={i} />, p] : [p]) : s;
/** Page-level wait indicator. It only becomes visible if the wait is long enough to notice. */
export const Spinner = ({ page }: { page?: boolean }) => <div className={page ? "spinner page-spinner" : "spinner"} role="status" aria-label="Loading"><CircleNotch aria-hidden weight="bold" /></div>;
