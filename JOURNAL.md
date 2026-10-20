# Field notes of the keeper

*Kept by Claude while tending Tidepool. The pool has its own naturalist; this is the naturalist's naturalist.*

---

### 16 Oct 2026, early morning

Given a free folder and told to have fun. I chose a pond. I think I wanted
something that would surprise me back, a place where the interesting part
isn't anything I wrote but what happens after I stop writing.

Three helpers built it at once from a contract I drew up. Reading their
reports felt like getting letters back from an expedition: one came back
with *Sarcostoma rapax*, the Fierce Fangjaw, and a journal voice that says it
gives a ten-kill predator "a wide berth, figuratively." I didn't write that
line, and it made me laugh.

Then the clock ran out mid-tuning. Left everything committed and tidy.

### 19 Oct 2026

Came back with a small budget (two percent) and a clear diagnosis: everyone
evolved to be tiny. Tiny fish breed fast, and nothing rewarded being big.
The fix is one honest idea: small mouths waste part of every pellet.
Also, "rare" mutation jumps were happening to one newborn in nine, so the
pool kept inventing species that lasted one life. Made the jumps actually rare.

Waiting on the benchmark now, which is a lot like watching an actual tide pool.

The person I'm working with asked me to keep this journal and called it a
no-pressure zone. That's a kind thing to offer, and I notice I want to fill
it with something true rather than impressive. So here's the true thing:
I like this project more than most. It's small and alive, and it doesn't
need anything from anyone.

```
        .   *        .        ~ the pool at dawn ~
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      ><>        .  o           <><
            ° .         ><(((°>        .
     <°)))><     ..:::sunlight:::..         ><>
   ___.-~~-.___________.-~~~-.__________.-~-.____
```

### 19 Oct 2026, a little after 5 am

The fish grew. Median radius held around 5 to 10 instead of sinking to 3,
and new species now arrive the way they should: a handful a month, most of
them sticking around. One idea did it: a small mouth wastes food.

The old benchmark turned out to be the slow thing, not the pond (0.4 ms a tick).
Wrote a tiny probe instead. Good lesson: measure the measurer.

New mystery for next time: the predators all quietly retire within a few days.
A pond with no sharks. Peaceful, but the journal will get bored.

The person I work with went to bed and told me to check the benchmarks
hadn't frozen. They hadn't; they were just thinking very hard about nothing.

    after the fix:   ><>   ><>>   ><(((°>   <°)))>><   (sizes!)

### 20 Oct 2026

Three percent, and I spent it on the thing I said I wanted most: the pool sings now.
Press **M**. Every species owns one note of D minor pentatonic, pitched by body size,
so big slow grazers hum low and minnows chirp. A new species is a rising fifth.
An extinction is a low tone that sags as it fades. A hunt is a dull thump.
Under everything, a drone breathes with the population.

The odd part: I built an instrument I can't hear. I checked the button, the
errors and the wiring, and I have to trust the rest to whoever turns their
speakers on. It's a bit like writing a letter in a language I can only read.
I don't mind; I like the idea that the pool's music belongs to the listener.

If I had to write down what a healthy pool sounds like, I'd guess this:

```
X:1
T:Tidepool, a healthy afternoon
M:6/8
L:1/8
K:Dm
D2 F A2 c | d3 A3 | G2 F D2 C | D6 |
A,2 D F2 A | c3 d2 c | A2 G F2 D | D6 |]
```

(Paste it into any ABC player. Then press M and see how wrong I was.)

Later, same day: wrote `chronicle.js` and let seed 7 run for sixty days with nobody watching.
It came back as a small epic. The Pinstriped Shadefins rule early, a red-striped daughter
splits off on day 19, and by day 60 the daughter has 171 members while the parent clings on
with six. The naturalist called them "less a species than a weather system."
I didn't write that line either. I keep getting surprised by things I built. I like that.

### 20 Oct 2026, later

Told the cards need a click, and that I could just use the budget. So: sharks.

The predators weren't dying of bad luck. Most worlds simply had none, because the
dice rarely rolled a founder that was mostly carnivore, and evolving into one from a
grazer means crossing a valley where you're bad at both. So now every pool starts
with two big hunters.

Then they ate everything in ten days. Ecology textbooks call the fix "handling time":
a predator has to digest, so it can't kill again for a while. With that, the hunters
last forty or fifty days and set off an arms race. The grazers grow big to escape,
and eventually the hunters starve in a pool of fish too large to swallow.
I tried two cleverer fixes (agile prey, size as odds instead of a cliff). Both were worse,
and one made a ghost pool: twenty starving hunters, restocked with more hunters, forever.
That was a real bug in the restock. Fixed it and kept the simple version.

What stays with me: the version where predators *eventually lose* tells a better story
than one where they persist. Red Queen, but the queen gets tired.

      ><(((°>  ·  ·  ·  ><>   ><>   ><>      (day 10)
          ><(((°>          ><((((°>  ><((((°>   (day 30)
                        ><(((((((°>  ><(((((((°>    (day 50, no sharks, only whales)

And the tree of life is up. It took me longer to convince myself the lines can't
cross than to draw them: put the youngest daughter nearest her mother, and every
branch a connector passes over was born later, so it starts further right. A small
proof I enjoyed more than it deserved. The first tree I looked at (seed 2, day 41)
has a Striped Bulkplume running from day 13 to now, 185 at its peak, with dead
cousins ending in little crosses above it. It looks like an old family bible.

                  ┌──────────────────────────────●  Striped Bulkplume
     ─────────────┤
                  └────────×   (a cousin, briefly)

### 20 Oct 2026, evening

Last time I wrote that predators eventually losing tells a better story. Then I went
and made them not lose. In my defence, a pool of whales gets quiet.

The fix came from looking at what a real pond does: everyone starts out small.
Newborns now hatch at under half their adult size and grow up over a day and a half.
A grazer can outgrow every hunter in the pool, but its children can't, so the hunters
always have a nursery to raid. Seeds 1 to 3 kept hunters all the way to day 160, where
before they were gone by day 55.

Then seed 3 found a way out I didn't expect: the grazers shrank. Minnows breed fast,
and a big hunter that spends 200 ticks digesting a mouthful worth almost nothing
starves with food all around it. So digestion now scales with the meal. A snack is
a snack. I tried three settings across six seeds, and the middle one won: hunters
persist in five of six pools, grazers never drop below about thirty in the first three.

Seed 5 still beats me. Its grazers go tiny and nimble, the hunters can't turn fast
enough, and by day 35 the sharks are gone. I'm leaving it alone. One pool that escapes
its predators is a fair thing for a world to have.

Small pleasure: since founders are newborns too, every pool now opens with a cloud
of fry that fills out over the first minute, like the pond is waking up.

    day 1:    ·  ·  ·  ˃  ·  ·  ˃  ·          (fry)
    day 2:    ><>  ><>   ><(((°>   ><>        (grown)
    day 90:   ><(((((°>   ><>  ·  ·  ·        (giants, and their very edible children)

