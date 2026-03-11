class Player {
  constructor(name) {
    this.name = name;
    this.hand = [];
    this.score = 0;
  }

  takeCards(cards) {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    this.hand.push(...shuffled);
  }

  flip() {
    return this.hand.length ? this.hand.shift() : null;
  }

  hasCards() {
    return this.hand.length > 0;
  }

  get cardCount() {
    return this.hand.length;
  }
}
