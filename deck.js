const SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

class Card {
  constructor(suit, value) {
    this.suit = suit;
    this.value = value;
    this.symbol = value === 'Joker' ? '🃏' : { Hearts: '♥\uFE0E', Diamonds: '♦\uFE0E', Clubs: '♣\uFE0E', Spades: '♠\uFE0E' }[suit];
    this.color  = (suit === 'Hearts' || suit === 'Diamonds') ? 'red' : 'black';
  }
}

class Deck {
  constructor(numValues = 13) {
    const values = VALUES.slice(0, numValues);
    this.cards = SUITS.flatMap(suit => values.map(value => new Card(suit, value)));
    // One joker per suit, introduced from level 3 onwards (numValues >= 6)
    if (numValues >= 6) {
      SUITS.forEach(suit => this.cards.push(new Card(suit, 'Joker')));
    }
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal(numPlayers) {
    const hands = Array.from({ length: numPlayers }, () => []);
    this.cards.forEach((card, i) => hands[i % numPlayers].push(card));
    return hands;
  }
}
