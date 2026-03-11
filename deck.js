const SUITS = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
const VALUES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

class Card {
  constructor(suit, value) {
    this.suit = suit;
    this.value = value;
    this.symbol = { Hearts: '♥', Diamonds: '♦', Clubs: '♣', Spades: '♠' }[suit];
    this.color = (suit === 'Hearts' || suit === 'Diamonds') ? 'red' : 'black';
  }
}

class Deck {
  constructor() {
    this.cards = SUITS.flatMap(suit => VALUES.map(value => new Card(suit, value)));
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
