import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import {
  Blackjack,
  Card,
  Hand,
  HandStatus,
  Suit,
  Rank,
} from './blackjack';

// Helper to build a Card quickly
function makeCard(rank: Rank, suit: Suit = Suit.SPADES, faceDown = false): Card {
  return { rank, suit, faceDown };
}

// Helper to build a Hand with given cards and status
function makeHand(cards: Card[], bet = 10, status = HandStatus.ACTIVE): Hand {
  return { cards, bet, status };
}

describe('Blackjack', () => {
  let component: Blackjack;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Blackjack],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(Blackjack);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    // Flush initial HTTP requests from ngOnInit
    httpMock.match(() => true).forEach(r => r.flush({ balance: 1000 }));
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('evaluateHand()', () => {
    it('correctly values a hand without aces', () => {
      const h = makeHand([makeCard(Rank.KING), makeCard(Rank.QUEEN)]);
      component.evaluateHand(h);
      expect(h.value).toBe(20);
      expect(h.isSoft).toBe(false);
    });

    it('detects blackjack (21 with exactly 2 cards)', () => {
      const h = makeHand([makeCard(Rank.ACE), makeCard(Rank.KING)]);
      component.evaluateHand(h);
      expect(h.value).toBe(21);
      expect(h.status).toBe(HandStatus.BLACKJACK);
    });

    it('detects bust (value > 21)', () => {
      const h = makeHand([makeCard(Rank.KING), makeCard(Rank.QUEEN), makeCard(Rank.TWO)]);
      component.evaluateHand(h);
      expect(h.value).toBe(22);
      expect(h.status).toBe(HandStatus.BUST);
    });

    it('handles a soft ace (ace counted as 11 without busting)', () => {
      const h = makeHand([makeCard(Rank.ACE), makeCard(Rank.SIX)]);
      component.evaluateHand(h);
      expect(h.value).toBe(17);
      expect(h.isSoft).toBe(true);
    });

    it('handles a hard ace (ace reduced to 1 to avoid bust)', () => {
      const h = makeHand([makeCard(Rank.ACE), makeCard(Rank.KING), makeCard(Rank.FIVE)]);
      component.evaluateHand(h);
      expect(h.value).toBe(16);
      expect(h.isSoft).toBe(false);
    });

    it('skips face-down cards when counting value', () => {
      const h = makeHand([makeCard(Rank.KING), makeCard(Rank.SEVEN, Suit.HEARTS, true)]);
      component.evaluateHand(h);
      expect(h.value).toBe(10);
    });

    it('does not set blackjack status for 3-card 21', () => {
      const h = makeHand([makeCard(Rank.SEVEN), makeCard(Rank.SEVEN), makeCard(Rank.SEVEN)]);
      component.evaluateHand(h);
      expect(h.value).toBe(21);
      expect(h.status).toBe(HandStatus.ACTIVE);
    });
  });

  describe('resolveHand()', () => {
    it('marks a bust hand as LOSS and returns 0', () => {
      const h = makeHand(
        [makeCard(Rank.KING), makeCard(Rank.QUEEN), makeCard(Rank.TWO)],
        10,
        HandStatus.BUST
      );
      const result = component.resolveHand(h, 18, false);
      expect(result).toBe(0);
      expect(h.status).toBe(HandStatus.LOSS);
    });

    it('player wins when dealer busts — returns bet + profit', () => {
      const h = makeHand([makeCard(Rank.KING), makeCard(Rank.EIGHT)], 10);
      component.evaluateHand(h);
      const result = component.resolveHand(h, 22, true);
      expect(result).toBe(20); // 10 bet returned + 10 profit
      expect(h.status).toBe(HandStatus.WIN);
    });

    it('player wins with higher value than dealer — returns bet + profit', () => {
      const h = makeHand([makeCard(Rank.KING), makeCard(Rank.NINE)], 10);
      component.evaluateHand(h);
      const result = component.resolveHand(h, 17, false);
      expect(result).toBe(20);
      expect(h.status).toBe(HandStatus.WIN);
    });

    it('player loses when dealer has higher value — returns 0', () => {
      const h = makeHand([makeCard(Rank.KING), makeCard(Rank.SIX)], 10);
      component.evaluateHand(h);
      const result = component.resolveHand(h, 19, false);
      expect(result).toBe(0);
      expect(h.status).toBe(HandStatus.LOSS);
    });

    it('push on equal values — returns the bet', () => {
      const h = makeHand([makeCard(Rank.KING), makeCard(Rank.EIGHT)], 10);
      component.evaluateHand(h);
      const result = component.resolveHand(h, 18, false);
      expect(result).toBe(10); // bet returned, no profit
      expect(h.status).toBe(HandStatus.PUSH);
    });

    it('blackjack pays 1.5× the bet plus the bet back', () => {
      const h = makeHand([makeCard(Rank.ACE), makeCard(Rank.KING)], 10, HandStatus.BLACKJACK);
      component.evaluateHand(h);
      // dealer has 18 (not blackjack)
      const result = component.resolveHand(h, 18, false);
      // bet(10) + 1.5 * bet(15) = 25
      expect(result).toBe(25);
      expect(h.status).toBe(HandStatus.WIN);
    });

    it('blackjack vs dealer blackjack (2 cards, value 21) is a push', () => {
      component.gameState.update(s => ({
        ...s,
        dealerHand: {
          cards: [makeCard(Rank.ACE), makeCard(Rank.KING)],
          bet: 0,
          status: HandStatus.BLACKJACK,
          value: 21,
        },
      }));
      const h = makeHand([makeCard(Rank.ACE), makeCard(Rank.KING)], 10, HandStatus.BLACKJACK);
      component.evaluateHand(h);
      const result = component.resolveHand(h, 21, false);
      expect(result).toBe(10); // push: bet returned
      expect(h.status).toBe(HandStatus.PUSH);
    });

    it('applies a boost percentage to winning hands', () => {
      const h = makeHand([makeCard(Rank.KING), makeCard(Rank.NINE)], 10);
      component.evaluateHand(h);
      // 10% boost: profit = 10 * 1.1 = 11, total return = 10 + 11 = 21
      const result = component.resolveHand(h, 17, false, 10);
      expect(result).toBe(21);
    });
  });
});
