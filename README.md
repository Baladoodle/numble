<img width="900" height="300" alt="logo-numble" src="https://github.com/user-attachments/assets/316b354d-f8bb-47ac-8b5e-6f531eea30ed" />

Inspired by the *Moj broj* round of the Serbian TV quiz show *Slagalica*. Six numbers are drawn one at a time, after which a target is rolled, and you have 50 seconds to compose an expression that lands on it, using only basic arithmetic + - \* / ( ).

You can play it here: https://baladoodle.github.io/numble/

<img width="900" height="507" alt="run" src="https://github.com/user-attachments/assets/539541d7-8614-4030-aec2-a9ebd593b725" />

## Numble:

There are 3 difficulties: 3-, 4- and 5-digit mode, switched by pressing D. Each one grants 6, 7 and 8 materials respectively, alongside 50/70/90 seconds to solve. The 3-digit mode is identical to the *Moj broj* round, with the only "difference" being that the target is rolled last (to guarantee a possible target).

<img width="900" height="280" alt="mode-badges" src="https://github.com/user-attachments/assets/c8164e32-ede2-4dfd-8b18-7945ce7fc00b" />

There are 2 modes: normal and **practice** mode, toggled by pressing P. In practice mode, the running sum is shown. Games in this mode are not saved to stats.

## Gameplay guide:

Everything is explained in-game (press ? for help). The game is currently desktop-only, and requires a keyboard. There are some mouse controls, but mouse isn’t required at all.

<img width="1300" height="100" alt="legend" src="https://github.com/user-attachments/assets/240dba23-735d-48e3-83fd-cefae4466c28" />

There is no real multiplayer, the game is local only. However, by picking a seed, you can guarantee the same materials/target for each player. Just make sure the round/digit count are aligned.

<img width="1200" height="700" alt="06-seed" src="https://github.com/user-attachments/assets/23019930-d5d6-487a-b058-ec8ac0a53ddb" />

The generated target is always possible.

<img width="900" height="350" alt="target" src="https://github.com/user-attachments/assets/d4ec628a-73f8-46a2-8cc8-23dfa538e4f5" />

## Planned features:

1. **Support for more languages.** First one will be Serbian Cyrillic. Second one whatever.

2. **Target difficulty.** The target is generated after all the materials have been rolled, to guarantee that any generated target is possible. This allows for the generation to be altered so it picks targets that require all 6+ materials to solve instead of being possible with 4. This could be bloat, however, as the stats menu would look like a periodic table of elements.

3. **A dark theme.** The background is pretty mild currently but there is no harm in a dark mode.

4. **Mobile support.** It is kind of hard to type brackets on mobile, so I am not sure how this could be practical.

5. **Challenge modes.** You'll see.

## Running it yourself:

There is nothing to install. Clone/download as zip, and run the html file.

The only network call the page makes is to Google Fonts for the three typefaces. Otherwise, it is 100% offline.

## Credits:

*Slagalica*, of course.

Built by Jovan Jovanović for fun. Used the *Minimax M3* model.
