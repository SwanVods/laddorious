import type { IconName } from '../hud/labels';
import { Dialog } from '../ui/Dialog';
import { Icon } from '../ui/Icon';

/** The rules of the game, in a few short sections (the user, 2026-10-17). */
export const RULES: ReadonlyArray<{ icon: IconName; title: string; text: string }> = [
  { icon: 'trophy', title: 'Race to 100', text: 'Be the first to land exactly on tile 100. Roll too high and you bounce back off the end.' },
  { icon: 'die', title: 'Everyone rolls at once', text: "Each round, every player rolls one die at the same time, and all pieces move together. Don't roll in time and the game rolls for you." },
  { icon: 'slide', title: 'Rockets and whirlpools', text: 'Stop where a rocket starts and it launches you up the board. Stop on a whirlpool and it drags you back down.' },
  { icon: 'swords', title: 'Face-offs', text: 'Land on the same tile as someone else and you face off. Two players play Rock, Paper, Scissors; three or four pick a side, and the smaller side wins. Losers go back 3 tiles.' },
  { icon: 'qmark', title: 'Mystery cards', text: 'End your move on a purple ? tile and you pick one card of three to play. You can swap up to two of them for new ones. Cards play one at a time after everyone has picked.' },
  { icon: 'shield', title: 'Cards', text: 'A card can move you, shield you from a whirlpool or an attack, or hit other players. If its target is missing when it plays, it fizzles.' },
];

/** The lobby's Help: how to play (2026-10-17). */
export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="How to play" className="help-dialog" onClose={onClose}>
      <div className="help-rules">
        {RULES.map((rule) => (
          <section key={rule.title} className="help-rule">
            <Icon name={rule.icon} className="help-icon" />
            <div>
              <h3 className="display">{rule.title}</h3>
              <p className="dialog-text">{rule.text}</p>
            </div>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
