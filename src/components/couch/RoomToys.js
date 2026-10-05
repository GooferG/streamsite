import Toy from './Toy';

// The room's toys (spec: Toys). They sit under the doors' labels and never on
// a door; the layer itself takes no pointer events, each toy does.
export default function RoomToys({ toys }) {
  if (!toys || !toys.length) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0" data-testid="room-toys">
      {toys.map((toy) => (
        <Toy key={toy.id} toy={toy} />
      ))}
    </div>
  );
}
