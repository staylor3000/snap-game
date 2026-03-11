import threading
import sys

from deck import Deck
from players import Player


def get_snap(current_player, other_player, pile, timeout=5.0):
    """
    Wait for either player to type 'snap'. The player whose turn it is acts first,
    but both players can race to call snap. Returns the winner or None on timeout.
    """
    winner = [None]
    stop = threading.Event()

    def listen(player):
        while not stop.is_set():
            try:
                entry = input()
            except EOFError:
                break
            if entry.strip().lower() == 'snap' and not stop.is_set():
                winner[0] = player
                stop.set()
                break

    threads = []
    for player in (current_player, other_player):
        t = threading.Thread(target=listen, args=(player,), daemon=True)
        t.start()
        threads.append(t)

    stop.wait(timeout=timeout)
    stop.set()

    return winner[0]


def award_pile(winner, pile):
    import random
    random.shuffle(pile)
    winner.take_cards(pile)
    winner.score += 1


def play_game():
    print("=== SNAP! ===\n")
    name1 = input("Enter name for Player 1: ").strip() or "Player 1"
    name2 = input("Enter name for Player 2: ").strip() or "Player 2"

    p1 = Player(name1)
    p2 = Player(name2)

    deck = Deck()
    deck.shuffle()
    hand1, hand2 = deck.deal(2)
    p1.take_cards(hand1)
    p2.take_cards(hand2)

    print(f"\n{p1.name} and {p2.name} each have {p1.card_count()} cards.\n")
    print("Rules: Press Enter on your turn to flip a card.")
    print("       If the top two cards match, type 'snap' and press Enter to win the pile!")
    print("       First player to collect all 52 cards wins.\n")

    pile = []
    players = [p1, p2]
    turn = 0  # index into players

    while p1.has_cards() and p2.has_cards():
        current = players[turn]
        other = players[1 - turn]

        print(f"{current.name}'s turn ({current.card_count()} cards) — press Enter to flip: ", end='', flush=True)
        input()

        card = current.flip()
        if card is None:
            print(f"{current.name} has no cards left!")
            break

        pile.append(card)
        print(f"  {current.name} flips: [{card}]   (pile: {len(pile)} card{'s' if len(pile) != 1 else ''})")

        # Check for snap condition
        if len(pile) >= 2 and pile[-1].value == pile[-2].value:
            print(f"\n*** SNAP opportunity! Top two cards both show {card.value}! ***")
            print(f"Both players: type 'snap' + Enter to win the pile of {len(pile)} cards! (5 seconds)\n")

            winner = get_snap(current, other, pile)

            if winner:
                award_pile(winner, pile)
                pile = []
                print(f"\n>>> {winner.name} called SNAP and wins the pile! "
                      f"({winner.name}: {p1.card_count() if winner is p1 else p2.card_count()} cards | "
                      f"{other.name}: {p1.card_count() if other is p1 else p2.card_count()} cards)\n")
                # Winner goes next
                turn = 0 if winner is p1 else 1
            else:
                print("\nNo one called snap in time — pile stays.\n")
                turn = 1 - turn
        else:
            turn = 1 - turn

        # Check if either player ran out mid-round
        if not current.has_cards() and pile:
            print(f"{current.name} is out of cards — they win the pile by default!")
            award_pile(current, pile)
            pile = []

    # Determine winner
    print("\n=== GAME OVER ===")
    if p1.card_count() > p2.card_count():
        champion = p1
    elif p2.card_count() > p1.card_count():
        champion = p2
    else:
        champion = None

    if champion:
        print(f"🏆  {champion.name} wins with {champion.card_count()} cards and {champion.score} pile(s) won!")
    else:
        print("It's a draw!")

    print(f"\nFinal scores — {p1.name}: {p1.score} pile(s) | {p2.name}: {p2.score} pile(s)")


if __name__ == '__main__':
    try:
        play_game()
    except KeyboardInterrupt:
        print("\n\nGame interrupted. Goodbye!")
        sys.exit(0)
