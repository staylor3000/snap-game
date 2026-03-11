class Player:
    def __init__(self, name):
        self.name = name
        self.hand = []   # cards yet to be played
        self.score = 0   # piles won

    def take_cards(self, cards):
        """Add cards to the bottom of the player's hand."""
        self.hand.extend(cards)

    def flip(self):
        """Remove and return the top card from the hand, or None if empty."""
        if self.hand:
            return self.hand.pop(0)
        return None

    def has_cards(self):
        return len(self.hand) > 0

    def card_count(self):
        return len(self.hand)
