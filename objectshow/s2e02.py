"""Odds & Ends, series 2, episode 2: "The Host".

The network has notes.  The note is: is the host replaceable?  Nine objects
get the badge and fifty seconds each to prove it.
"""

import math

import s2e01
import stage
from cast import CAST, pose
from draw import (GROUND, H, W, bounce, clamp, ease_back, ease_in_out,
                  ease_out, lerp, rand01, set_rgb, text_at)
from engine import (Show, camera, facial, glow_eyes, idle, look_at,
                    silhouette, speaks, talker)
from timeline import A, S

TOTAL = 840.0
FIELD = ["Spanner", "Cone", "Clip", "Bulb", "Mugsy", "Sticky", "Fuzz",
         "Gloss", "Reel"]
BOXED = ["Volt", "Cube", "Mitt", "Plate", "Spork"]
ORDER = ["Spanner", "Clip", "Cone", "Bulb", "Fuzz", "Gloss", "Reel", "Sticky",
         "Mugsy"]
SCORES = {"Spanner": 2, "Clip": 1, "Cone": 1, "Bulb": 3, "Fuzz": 2,
          "Gloss": 5, "Reel": 2, "Sticky": 3, "Mugsy": 9}
NOMINEES = ["Clip", "Cone", "Spanner", "Reel"]
VOTES = {"Bulb": 8, "Spanner": 12, "Cone": 19, "Clip": 21, "Volt": 40}


BEATS = [
    dict(key="previously", beats=[
        A(1.6, "h_prev1"),
        S("Mega", "Previously, on Odds and Ends:", "smug", act="h_prev1"),
        S("Mega", "the kitchen objects woke up in a box, in a garage.",
          "happy", act="h_prev1"),
        S("Mega", "The garage had opinions.", "flat", act="h_prev2"),
        S("Mega", "Somebody unwound an extension lead and climbed it.",
          "smug", act="h_prev3"),
        S("Mega", "And a tin of magnolia became the floor.", "happy",
          act="h_prev4"),
        A(1.8, "h_prev4"),
    ]),

    dict(key="vote", beats=[
        A(2.6, "stage"),
        S("Mega", "Sharp Objects. The votes are in.", "smug", act="stage"),
        A(1.2, "tally_Bulb"),
        S("Mega", "Bulb: eight.", "happy", act="tally_Bulb"),
        S("Bulb", "Eight! That is nearly ten!", "starry", act="tally_Bulb"),
        A(1.2, "tally_Spanner"),
        S("Mega", "Spanner: twelve.", "happy", act="tally_Spanner"),
        S("Spanner", "Twelve objects looked at a wrench and said 'that one'.",
          "flat", act="tally_Spanner"),
        S("Mega", "You said you were not a wrench.", "smug",
          act="tally_Spanner"),
        S("Spanner", "I said it. They did not listen.", "sad",
          act="tally_Spanner"),
        A(1.2, "tally_Cone"),
        S("Mega", "Cone: nineteen.", "happy", act="tally_Cone"),
        S("Cone", "The public has never understood infrastructure.", "flat",
          act="tally_Cone"),
        A(1.2, "tally_Clip"),
        S("Mega", "Clip: twenty-one.", "happy", act="tally_Clip"),
        S("Clip", "Twenty-one? I am the most watchable object here.", "shock",
          act="tally_Clip"),
        A(1.4, "tally_Volt"),
        S("Mega", "Volt: forty.", "smug", act="tally_Volt"),
        S("Volt", "...Forty.", "flat", act="tally_Volt"),
        S("Mega", "Forty.", "smug", act="tally_Volt"),
        S("Volt", "I was out of the box for ONE episode.", "furious",
          act="verdict"),
        S("Mega", "You were.", "smug", act="verdict"),
        S("Volt", "One. Episode.", "furious", act="verdict"),
        S("Mega", "Volt. You have been eliminated.", "flat", act="verdict"),
        S("Volt", "I did not even DO anything!", "furious", act="verdict"),
        S("Mega", "You held a ladder badly.", "smug", act="verdict"),
        S("Volt", "CONE held the ladder badly!", "furious", act="verdict"),
        S("Cone", "I let go of the ladder deliberately. That is different.",
          "flat", act="verdict"),
        S("Volt", "THAT IS WORSE.", "furious", act="fling"),
        A(2.8, "fling"),
        S("Cube", "Welcome back.", "beam", act="slam_shut"),
        S("Volt", "Do not.", "flat", act="slam_shut"),
        S("Plate", "He was gone eleven minutes.", "sly", act="slam_shut"),
        S("Mitt", "There is always room.", "beam", act="slam_shut"),
        S("Volt", "I hate the room.", "sad", act="slam_shut"),
        S("Spork", "Is the lawnmower still looking at us?", "worried",
          act="slam_shut"),
        S("Volt", "YES.", "furious", act="slam_shut"),
        A(1.8, "slam_shut"),
    ]),

    dict(key="title", beats=[
        A(9.0, "logo"),
    ]),

    dict(key="brief", beats=[
        A(2.4, "h_intro"),
        S("Mega", "Last week I said this week would be the lawnmower.",
          "smug", act="h_intro"),
        S("Mega", "It is not going to be the lawnmower.", "flat",
          act="h_intro"),
        S("Spork", "You said it TWICE.", "shock", act="h_intro"),
        S("Mega", "Today's challenge is about ME.", "smug", act="h_intro"),
        S("Clip", "Finally.", "smug", act="h_intro"),
        S("Mega", "The network has notes.", "flat", act="h_intro"),
        S("Mugsy", "There is a network?", "worried", act="h_intro"),
        S("Mega", "There are notes.", "flat", act="h_intro"),
        S("Mega", "The note is: 'is the host replaceable?'", "sad",
          act="h_intro"),
        S("Sticky", "That is a MEAN note!", "shock", act="h_intro"),
        S("Mega", "It is a fair note. So today, you host.", "flat",
          act="h_rules"),
        S("Mega", "One badge. Nine of you. Fifty seconds each.", "smug",
          act="h_rules"),
        S("Mega", "Run a round. Any round. Make it a show.", "happy",
          act="h_rules"),
        S("Mega", "Best host wins immunity. The worst go up for elimination.",
          "smug", act="h_rules"),
        S("Cone", "How is 'best' defined?", "flat", act="h_rules"),
        S("Mega", "By me.", "smug", act="h_rules"),
        S("Cone", "That is not a definition.", "flat", act="h_rules"),
        S("Mega", "It is the definition I have used for nine episodes.",
          "smug", act="h_rules"),
        S("Bulb", "I have an idea for my slot!", "starry", act="h_rules"),
        S("Mega", "You have nine minutes to have a worse one.", "flat",
          act="h_rules"),
        A(2.0, "h_badge"),
        S("Mega", "This is the badge. Wear it, and you are the host.", "smug",
          act="h_badge"),
        S("Gloss", "Does it come in another colour?", "worried",
          act="h_badge"),
        S("Mega", "No.", "flat", act="h_badge"),
        S("Gloss", "Then I shall be hosting in magnolia.", "smug",
          act="h_badge"),
        S("Mega", "Also: teams are over. That was a one-week idea.", "flat",
          act="h_badge"),
        S("Bulb", "It was MY idea!", "starry", act="h_badge"),
        S("Mega", "It was not.", "flat", act="h_badge"),
        S("Spanner", "It genuinely was not.", "flat", act="h_badge"),
        A(2.0, "h_badge"),
    ]),

    dict(key="auditions", beats=[
        # 1. Spanner: correct, and over
        A(2.2, "h_a_Spanner"),
        S("Mega", "First up. Spanner.", "smug", act="h_a_Spanner"),
        S("Spanner", "Challenge: pick up that screw.", "flat",
          act="h_a_Spanner"),
        A(1.2, "h_a_Spanner"),
        S("Spanner", "Fuzz picked it up. Fuzz wins. Done.", "flat",
          act="h_a_Spanner"),
        A(2.4, "h_a_Spanner"),
        S("Mega", "That was nineteen seconds.", "flat", act="h_a_Spanner"),
        S("Spanner", "It was efficient.", "flat", act="h_a_Spanner"),
        S("Mega", "It was meant to be a show.", "flat", act="h_a_Spanner"),
        S("Spanner", "It was a show. It was a short one.", "flat",
          act="h_a_Spanner"),
        S("Volt", "I hated it. It was correct, and I hated it.", "flat",
          act="h_a_Spanner"),
        S("Fuzz", "Did I win something? What did I win?", "starry",
          act="h_a_Spanner"),
        S("Spanner", "Nothing. It was a demonstration.", "flat",
          act="h_a_Spanner"),
        S("Fuzz", "I have never felt so ALIVE.", "beam", act="h_a_Spanner"),
        S("Mega", "Spanner, a show has a beginning, a middle and an end.",
          "flat", act="h_a_Spanner"),
        S("Spanner", "It had all three. They were adjacent.", "flat",
          act="h_a_Spanner"),
        S("Cone", "Do not use that word.", "angry", act="h_a_Spanner"),
        S("Spanner", "Which word.", "flat", act="h_a_Spanner"),
        S("Cone", "You know which word.", "flat", act="h_a_Spanner"),
        A(1.6, "h_a_Clip"),

        # 2. Clip: entirely teasers
        S("Clip", "WELCOME BACK to the show!", "starry", act="h_a_Clip"),
        S("Mugsy", "We have not been anywhere.", "flat", act="h_a_Clip"),
        S("Clip", "Coming up: everything you have been waiting for!",
          "starry", act="h_a_Clip"),
        S("Clip", "But FIRST—", "smug", act="h_a_Clip"),
        S("Clip", "—a look at what is coming up.", "smug", act="h_a_Clip"),
        S("Sticky", "Ooh!", "beam", act="h_a_Clip"),
        S("Clip", "Coming up: the thing I mentioned. Right after this.",
          "starry", act="h_a_Clip"),
        S("Clip", "Still to come: the segment. Do not go anywhere.",
          "starry", act="h_a_Clip"),
        S("Gloss", "Where would we go?", "worried", act="h_a_Clip"),
        S("Clip", "EXACTLY. Coming up: where you would go.", "smug",
          act="h_a_Clip"),
        S("Reel", "There is nowhere to go. I have measured it.", "flat",
          act="h_a_Clip"),
        S("Mega", "After what? There is no break. We are in a garage.",
          "flat", act="h_a_Clip"),
        S("Clip", "We will be RIGHT BACK.", "smug", act="h_a_Clip"),
        A(2.0, "h_a_Clip"),
        S("Clip", "And we are back! Welcome back!", "starry", act="h_a_Clip"),
        S("Cone", "You did not leave.", "flat", act="h_a_Clip"),
        S("Clip", "Coming up: why I did not leave.", "smug", act="h_a_Clip"),
        S("Mega", "Time.", "flat", act="h_a_Clip"),
        S("Clip", "NEXT WEEK, ON—", "starry", act="h_a_Clip"),
        S("Mega", "TIME.", "angry", act="h_a_Clip"),
        A(1.6, "h_a_Cone"),

        # 3. Cone: the rules, all of them
        S("Cone", "Before we begin. Rule one: no tape.", "flat",
          act="h_a_Cone"),
        S("Mugsy", "Oh no.", "worried", act="h_a_Cone"),
        S("Cone", "Rule two: no glue. Rule three: no adjacency.", "flat",
          act="h_a_Cone"),
        S("Clip", "That one is about me.", "flat", act="h_a_Cone"),
        S("Cone", "Rule four is also about you.", "flat", act="h_a_Cone"),
        S("Cone", "Rules five through eleven concern the ladder.", "flat",
          act="h_a_Cone"),
        S("Cone", "Rule twelve: infrastructure may not be questioned.",
          "smug", act="h_a_Cone"),
        S("Spanner", "That is not a rule.", "flat", act="h_a_Cone"),
        S("Cone", "Rule thirteen: rule twelve is a rule.", "flat",
          act="h_a_Cone"),
        S("Cone", "Rule fourteen: no bouncing during the rules.", "flat",
          act="h_a_Cone"),
        S("Fuzz", "WHAT.", "shock", act="h_a_Cone"),
        S("Cone", "Rule fifteen: no shouting WHAT during rule fourteen.",
          "flat", act="h_a_Cone"),
        S("Fuzz", "WHAT.", "shock", act="h_a_Cone"),
        S("Cone", "Rule sixteen.", "flat", act="h_a_Cone"),
        S("Mega", "Cone. When does the challenge start?", "flat",
          act="h_a_Cone"),
        S("Cone", "After the rules.", "flat", act="h_a_Cone"),
        S("Mega", "When do the rules end?", "flat", act="h_a_Cone"),
        S("Cone", "Rule forty-one: refer to rule one.", "flat",
          act="h_a_Cone"),
        A(1.6, "h_buzz"),
        S("Mega", "Time.", "flat", act="h_buzz"),
        S("Cone", "I had not finished the preamble.", "sad", act="h_buzz"),
        A(1.4, "h_a_Bulb"),

        # 4. Bulb: four formats, then darkness
        S("Bulb", "Hello! Today's challenge is a QUIZ.", "starry",
          act="h_a_Bulb"),
        S("Bulb", "New idea: it is a RACE.", "starry", act="h_a_Bulb"),
        S("Bulb", "New idea: it is a quiz ABOUT a race.", "starry",
          act="h_a_Bulb"),
        S("Bulb", "New idea: everyone is the host.", "starry", act="h_a_Bulb"),
        S("Mega", "That is my job. You are giving away my job.", "angry",
          act="h_a_Bulb"),
        S("Bulb", "New idea: the challenge is a SONG.", "starry",
          act="h_a_Bulb"),
        S("Mugsy", "Can you sing?", "worried", act="h_a_Bulb"),
        S("Bulb", "No! New idea: the challenge is NOT a song.", "starry",
          act="h_a_Bulb"),
        S("Spanner", "That is the same as having no challenge.", "flat",
          act="h_a_Bulb"),
        S("Bulb", "New idea: no challenge!", "starry", act="h_a_Bulb"),
        S("Bulb", "New idea: the GARAGE is the host.", "starry",
          act="h_a_Bulb"),
        S("Gloss", "How would that even—", "worried", act="h_a_Bulb"),
        S("Bulb", "New idea—", "starry", act="h_flicker"),
        A(2.2, "h_flicker"),
        S("Mugsy", "The lights.", "shock", act="h_flicker"),
        S("Bulb", "That is me. I have had four ideas.", "dizzy",
          act="h_flicker"),
        S("Bulb", "New idea: fewer ideas.", "worried", act="h_flicker"),
        A(1.8, "h_lit"),
        S("Mega", "That was your best one.", "flat", act="h_lit"),
        S("Bulb", "I KNOW. And I hated it.", "sad", act="h_lit"),
        A(1.4, "h_a_Fuzz"),

        # 5. Fuzz: visible one third of the time
        S("Fuzz", "HELLO AND WELCOME—", "starry", act="h_a_Fuzz"),
        S("Fuzz", "—TO THE—", "starry", act="h_a_Fuzz"),
        S("Fuzz", "—SHOW!", "starry", act="h_a_Fuzz"),
        S("Mega", "Fuzz, we can see you for about a third of this.", "flat",
          act="h_a_Fuzz"),
        S("Fuzz", "THAT IS THE—", "starry", act="h_a_Fuzz"),
        S("Fuzz", "—FORMAT!", "starry", act="h_a_Fuzz"),
        S("Reel", "I find this extremely stressful.", "worried",
          act="h_a_Fuzz"),
        S("Fuzz", "AND THE WINNER IS—", "starry", act="h_a_Fuzz"),
        S("Fuzz", "—CONGRATULATIONS!", "starry", act="h_a_Fuzz"),
        S("Fuzz", "OUR FIRST CONTESTANT IS—", "starry", act="h_a_Fuzz"),
        S("Fuzz", "—AND THEY HAVE ALREADY—", "starry", act="h_a_Fuzz"),
        S("Cone", "This is a procedural nightmare.", "flat",
          act="h_a_Fuzz"),
        S("Gloss", "I feel motion sick, and I am a tin.", "worried",
          act="h_a_Fuzz"),
        S("Mugsy", "Who won?", "worried", act="h_a_Fuzz"),
        S("Fuzz", "I DID NOT SAY.", "beam", act="h_a_Fuzz"),
        S("Sticky", "That was so exciting and I understood none of it.",
          "beam", act="h_a_Fuzz"),
        A(1.6, "h_a_Gloss"),

        # 6. Gloss: not a challenge, a feelings segment
        S("Gloss", "Welcome. Sit down. How are you?", "smug",
          act="h_a_Gloss"),
        S("Mugsy", "...Fine?", "worried", act="h_a_Gloss"),
        S("Gloss", "No. How ARE you.", "flat", act="h_a_Gloss"),
        S("Mugsy", "Oh. Not great, actually.", "sad", act="h_a_Gloss"),
        S("Gloss", "Tell me everything.", "beam", act="h_a_Gloss"),
        S("Mega", "This is not a challenge.", "flat", act="h_a_Gloss"),
        S("Gloss", "It is an EMOTIONAL challenge.", "furious",
          act="h_a_Gloss"),
        S("Gloss", "Reel. When they left you half unwound. How did that feel?",
          "sad", act="h_sad"),
        S("Reel", "...Nobody has ever asked.", "sad", act="h_sad"),
        S("Reel", "It felt like being left in the middle of a sentence.",
          "sad", act="h_sad"),
        S("Gloss", "YES.", "sad", act="h_sad"),
        A(2.0, "h_sad"),
        S("Gloss", "Spanner. When they call you a wrench. Where do you feel it?", "sad", act="h_sad"),
        S("Spanner", "...In the jaw.", "sad", act="h_sad"),
        S("Gloss", "In the JAW.", "sad", act="h_sad"),
        S("Mitt", "Oh, that one got me.", "sad", act="h_sad"),
        S("Volt", "I am not crying. I am leaking. It is different.",
          "sad", act="h_sad"),
        S("Gloss", "And they called me 'a bit beige'.", "sad", act="h_sad"),
        S("Gloss", "A BIT. BEIGE.", "furious", act="h_sad"),
        S("Sticky", "I am also crying now.", "sad", act="h_sad"),
        S("Mega", "Nobody has completed a challenge in six minutes.", "flat",
          act="h_sad"),
        S("Gloss", "We have completed something FAR more important.", "beam",
          act="h_sad"),
        S("Mega", "We have not.", "flat", act="h_sad"),
        A(1.6, "h_a_Reel"),

        # 7. Reel: cannot host an unmeasured space
        S("Reel", "Before we start. How long is my slot?", "worried",
          act="h_a_Reel"),
        S("Mega", "Fifty seconds.", "flat", act="h_a_Reel"),
        S("Reel", "Fifty seconds of what length?", "worried",
          act="h_a_Reel"),
        S("Mega", "...Seconds.", "flat", act="h_a_Reel"),
        S("Reel", "I will need to measure the garage first.", "worried",
          act="h_measure"),
        S("Mega", "You will not.", "flat", act="h_measure"),
        A(1.8, "h_measure"),
        S("Reel", "Four metres by six. The shelf is at two point four.",
          "flat", act="h_measure"),
        S("Reel", "The crate is eight hundred and ten millimetres.", "flat",
          act="h_measure"),
        S("Spanner", "That is correct, actually.", "flat", act="h_measure"),
        S("Reel", "I KNOW it is correct.", "shock", act="h_measure"),
        S("Reel", "Mega. How tall are you?", "worried", act="h_measure"),
        S("Mega", "I am not being measured.", "angry", act="h_measure"),
        S("Reel", "Everything is being measured. That is the format.",
          "flat", act="h_measure"),
        S("Mega", "That is NOT the format!", "furious", act="h_measure"),
        S("Reel", "Four hundred and ten millimetres. With the horn.",
          "flat", act="h_measure"),
        S("Mega", "Reel. Host something.", "angry", act="h_measure"),
        S("Reel", "I cannot host an unmeasured space.", "worried",
          act="h_measure"),
        S("Mega", "That is the most 'you' sentence anyone has said.", "flat",
          act="h_measure"),
        S("Reel", "Thank you. It was forty-one characters.", "beam",
          act="h_measure"),
        A(1.6, "h_a_Sticky"),

        # 8. Sticky: gives the format away
        S("Sticky", "Hello everyone! You are all doing so well!", "beam",
          act="h_a_Sticky"),
        S("Sticky", "Today's challenge is: nothing! You have all won!",
          "beam", act="h_a_Sticky"),
        S("Mugsy", "What?", "shock", act="h_a_Sticky"),
        S("Sticky", "Everyone gets immunity! Nobody goes in the box!",
          "beam", act="h_a_Sticky"),
        S("Volt", "I am ALREADY in the box.", "furious", act="h_a_Sticky"),
        S("Sticky", "You get immunity too!", "beam", act="h_a_Sticky"),
        S("Volt", "...I do?", "worried", act="h_a_Sticky"),
        S("Sticky", "Everyone is safe forever!", "beam", act="h_a_Sticky"),
        S("Sticky", "And the prize is: a hug! From me!", "beam",
          act="h_a_Sticky"),
        S("Spanner", "I do not want that.", "flat", act="h_a_Sticky"),
        S("Sticky", "You are getting it!", "beam", act="h_a_Sticky"),
        S("Spanner", "...Fine.", "flat", act="h_a_Sticky"),
        S("Mega", "Sticky. That is not a show. That is a party.", "flat",
          act="h_a_Sticky"),
        S("Sticky", "YES.", "beam", act="h_a_Sticky"),
        S("Mega", "There has to be a loser.", "flat", act="h_a_Sticky"),
        S("Sticky", "Why?", "happy", act="h_a_Sticky"),
        A(2.4, "h_a_Sticky"),
        S("Mega", "Next.", "flat", act="h_a_Sticky"),
        S("Sticky", "He did not answer!", "shock", act="h_a_Sticky"),
        S("Cube", "He never does.", "flat", act="h_a_Sticky"),
        A(1.6, "h_a_Mugsy"),

        # 9. Mugsy: accidentally excellent
        S("Mega", "Last. Mugsy.", "smug", act="h_a_Mugsy"),
        S("Mugsy", "I would rather not.", "worried", act="h_a_Mugsy"),
        S("Mega", "Wear the badge.", "smug", act="h_a_Mugsy"),
        S("Mugsy", "I do not want to be in charge of anything.", "worried",
          act="h_a_Mugsy"),
        S("Mega", "Wear it.", "flat", act="h_a_Mugsy"),
        A(2.2, "h_a_Mugsy"),
        S("Mugsy", "...Hello.", "worried", act="h_a_Mugsy"),
        S("Mugsy", "Right. Bulb. You go first, because you have been waiting "
          "all episode.", "flat", act="h_a_Mugsy"),
        S("Bulb", "I HAVE been waiting all episode!", "starry",
          act="h_a_Mugsy"),
        S("Mugsy", "Your challenge is: have one idea. Just one. Your best "
          "one.", "flat", act="h_a_Mugsy"),
        S("Bulb", "...One?", "worried", act="h_a_Mugsy"),
        S("Mugsy", "One. Take your time.", "happy", act="h_a_Mugsy"),
        A(2.8, "h_a_Mugsy"),
        S("Bulb", "...I would like everyone to be nicer to Reel.", "worried",
          act="h_a_Mugsy"),
        S("Reel", "Oh.", "shock", act="h_a_Mugsy"),
        S("Mugsy", "That is a good idea.", "beam", act="h_a_Mugsy"),
        S("Bulb", "IT IS?", "starry", act="h_a_Mugsy"),
        S("Mugsy", "It is your best one.", "beam", act="h_a_Mugsy"),
        S("Sticky", "I am crying AGAIN.", "sad", act="h_a_Mugsy"),
        S("Mugsy", "Spanner. You ran the fastest round of the day.",
          "happy", act="h_a_Mugsy"),
        S("Spanner", "I did.", "flat", act="h_a_Mugsy"),
        S("Mugsy", "You are allowed to say you are proud of it.", "happy",
          act="h_a_Mugsy"),
        S("Spanner", "...I am proud of it.", "beam", act="h_a_Mugsy"),
        S("Clip", "I feel like I am watching a different show.", "flat",
          act="h_a_Mugsy"),
        S("Mugsy", "Same show. Nicer host.", "beam", act="h_a_Mugsy"),
        S("Mugsy", "Gloss. You are next. You get to pick the colour of "
          "something.", "happy", act="h_clap"),
        S("Gloss", "ANYTHING?", "starry", act="h_clap"),
        S("Mugsy", "The crate.", "happy", act="h_clap"),
        S("Gloss", "I will need a moment. This is the best day of my life.",
          "starry", act="h_clap"),
        S("Mugsy", "Take the moment.", "beam", act="h_clap"),
        A(2.6, "h_clap"),
        S("Mega", "...Right. Yes. That is time.", "flat", act="h_clap"),
        A(1.8, "h_clap"),
    ]),

    dict(key="judging2", beats=[
        A(2.0, "h_score"),
        S("Mega", "Scores.", "smug", act="h_score"),
        S("Mega", "Spanner: efficient. Two.", "flat", act="h_score"),
        S("Spanner", "Two is fine.", "flat", act="h_score"),
        S("Mega", "Clip: no content whatsoever. One.", "flat", act="h_score"),
        S("Clip", "COMING UP: my appeal.", "smug", act="h_score"),
        S("Mega", "Cone: never started. One.", "flat", act="h_score"),
        S("Cone", "I object under rule twelve.", "flat", act="h_score"),
        S("Mega", "Bulb: four formats in fifty seconds. Three.", "flat",
          act="h_score"),
        S("Bulb", "THREE! That is nearly four!", "starry", act="h_score"),
        S("Mega", "Fuzz: unwatchable. Physically unwatchable. Two.", "flat",
          act="h_score"),
        S("Fuzz", "I was VERY watchable. Briefly. Repeatedly.", "beam",
          act="h_score"),
        S("Mega", "Gloss: made four objects cry. Five.", "flat",
          act="h_score"),
        S("Gloss", "FIVE?", "shock", act="h_score"),
        S("Mega", "It was moving. It was not a show.", "flat", act="h_score"),
        S("Mega", "Reel: measured the garage. Two.", "flat", act="h_score"),
        S("Reel", "It needed measuring.", "flat", act="h_score"),
        S("Mega", "Sticky: gave away the entire format. Three.", "flat",
          act="h_score"),
        S("Sticky", "Everyone was HAPPY.", "beam", act="h_score"),
        A(1.6, "h_rig"),
        S("Mega", "And Mugsy.", "flat", act="h_rig"),
        A(2.2, "h_rig"),
        S("Clip", "Say it.", "smug", act="h_rig"),
        S("Mega", "Nine.", "sad", act="h_rig"),
        S("Volt", "NINE?", "shock", act="h_rig"),
        S("Mega", "It was good. It was annoyingly good.", "sad", act="h_rig"),
        S("Mega", "...Which is why I am revising it to a four.", "smug",
          act="h_rig"),
        A(1.8, "h_rig"),
        S("Mitt", "That is not allowed.", "flat", act="h_rig"),
        S("Plate", "That is rigging.", "sly", act="h_rig"),
        S("Cube", "That is CLEARLY rigging.", "flat", act="h_rig"),
        S("Volt", "I have never been happier in my life.", "beam",
          act="h_rig"),
        S("Mega", "The box does not get a vote.", "angry", act="h_rig"),
        S("Spork", "The box is the audience.", "flat", act="h_rig"),
        A(2.4, "h_rig"),
        S("Mega", "...Fine. Nine.", "sad", act="h_rig"),
        S("Mugsy", "I did not want the nine.", "worried", act="h_rig"),
        S("Mega", "You have the nine.", "angry", act="h_rig"),
        A(1.8, "h_rig"),
    ]),

    dict(key="winner2", beats=[
        A(2.0, "h_win"),
        S("Mega", "Mugsy wins immunity. Again. Somehow.", "flat",
          act="h_win"),
        S("Mugsy", "I only asked people how they were.", "worried",
          act="h_win"),
        S("Mega", "I KNOW.", "angry", act="h_win"),
        S("Mega", "Do not do it again.", "flat", act="h_win"),
        S("Mugsy", "I might.", "sly", act="h_win"),
        A(2.0, "h_win"),
        S("Mega", "Give me the badge.", "flat", act="h_win"),
        A(2.2, "h_win"),
        S("Mugsy", "...It is quite nice, actually.", "beam", act="h_win"),
        S("Mega", "GIVE ME THE BADGE.", "furious", act="h_win"),
        A(2.0, "h_win"),
        S("Clip", "Can I have the badge?", "smug", act="h_win"),
        S("Mega", "No.", "flat", act="h_win"),
        S("Clip", "Coming up: me having the badge.", "smug", act="h_win"),
        S("Mega", "Bottom four: Clip. Cone. Spanner. Reel.", "smug",
          act="h_win"),
        S("Reel", "I MEASURED.", "shock", act="h_win"),
        S("Mega", "You measured INSTEAD of hosting.", "flat", act="h_win"),
        A(2.0, "h_win"),
    ]),

    dict(key="elimination", beats=[
        A(2.6, "stage2"),
        S("Mega", "Clip. Cone. Spanner. Reel. One of you goes in the box.",
          "smug", act="podium"),
        S("Volt", "GOOD.", "beam", act="podium"),
        S("Clip", "Coming up: why it should not be me.", "smug",
          act="podium"),
        S("Mega", "That is not coming up. That is now.", "flat",
          act="podium"),
        S("Clip", "...Why it should not be me: I am watchable.", "smug",
          act="podium"),
        S("Spanner", "You were not.", "flat", act="podium"),
        S("Cone", "I would like to appeal on procedural grounds.", "flat",
          act="podium"),
        S("Mega", "Which grounds?", "flat", act="podium"),
        S("Cone", "All of them.", "flat", act="podium"),
        S("Spanner", "I did the challenge correctly and quickly.", "flat",
          act="podium"),
        S("Mega", "You did it so quickly the show stopped existing.", "flat",
          act="podium"),
        S("Spanner", "That is a compliment with extra words in it.", "flat",
          act="podium"),
        S("Reel", "If I am eliminated, could somebody wind me up first?",
          "worried", act="podium"),
        S("Mitt", "I will do it, love.", "beam", act="podium"),
        S("Reel", "...Oh. Thank you.", "sad", act="podium"),
        S("Bulb", "I have an idea about who should go.", "starry",
          act="podium"),
        S("Spanner", "Bulb.", "flat", act="podium"),
        S("Bulb", "It was going to be me. I was going to say me.", "sad",
          act="podium"),
        A(1.6, "votes"),
        S("Mega", "Vote in the comments.", "happy", act="votes"),
        S("Mega", "And somebody take the badge off Mugsy.", "angry",
          act="votes"),
        S("Mugsy", "No.", "beam", act="votes"),
        A(2.8, "votes"),
    ]),

    dict(key="outro", beats=[
        A(1.8, "next"),
        S("Mega", "Next time, on Odds and Ends:", "happy", act="next"),
        S("Mega", "the lawnmower.", "smug", act="next"),
        S("Spork", "You have said that TWICE.", "shock", act="next"),
        S("Mega", "The lawnmower.", "flat", act="next"),
        S("Volt", "It is never going to be the lawnmower.", "flat",
          act="h_mower"),
        A(2.6, "h_mower"),
        S("Mega", "...It might be the lawnmower.", "shock", act="h_mower"),
        A(2.0, "h_mower"),
        A(7.0, "endcard"),
    ]),
]


# ---------------------------------------------------------------- scenes ---

VOTE_X = {n: 200 + i * 190 for i, n in enumerate(
    ["Bulb", "Spanner", "Cone", "Clip", "Volt"])}
VOTE_BOX_X = 1150
BOX_X, BOX_W = 130, 220
CRATE_X = 420
CRATE_H = 104
MEGA_X = 620
AUD_X0, AUD_X1 = 720, 1210
BRIEF_X = {n: 300 + i * 100 for i, n in enumerate(FIELD)}
SCORE_GRID = [(230 + (i % 3) * 400, 96 + (i // 3) * 128)
               for i in range(9)]
ELIM_X = {n: 320 + i * 190 for i, n in enumerate(NOMINEES)}
RULES = ["RULE 1: NO TAPE", "RULE 2: NO GLUE", "RULE 3: NO ADJACENCY",
         "RULE 4: ALSO NO ADJACENCY", "RULES 5-11: THE LADDER",
         "RULE 12: INFRASTRUCTURE", "RULE 13: RULE 12 IS A RULE",
         "RULE 14: NO BOUNCING", "RULE 15: NO 'WHAT'", "RULE 16: ...",
         "RULE 41: SEE RULE 1"]
FORMATS = ["A QUIZ", "A RACE", "A QUIZ ABOUT A RACE", "EVERYONE HOSTS",
           "A SONG", "NOT A SONG", "NO CHALLENGE", "THE GARAGE HOSTS"]


def box_crew(cr, show, beat, T, x=BOX_X, w=BOX_W, scale=0.26):
    stage.cardboard_box(cr, x, GROUND, w, 150, "KITCHEN MISC")
    for i, name in enumerate(BOXED):
        fx = x - w / 2 + 26 + (w - 52) * (i + 0.5) / len(BOXED)
        CAST[name].draw(cr, pose(fx, GROUND - 30, s=scale,
                                 expr=facial(beat, name, "flat"),
                                 mouth=speaks(show, beat, name, T)), T)


def tears(cr, x, y, s, T, seed="t"):
    """Two drops, falling and repeating.  For the feelings segment."""
    for sgn in (-1, 1):
        ph = ((T * 1.4 + (0.5 if sgn > 0 else 0.0)) % 1.0)
        cr.new_path()
        cr.arc(x + sgn * 16 * s, y + ph * 46 * s, 5 * s, 0, math.tau)
        set_rgb(cr, (0.45, 0.72, 0.92), (1 - ph) * 0.9)
        cr.fill()


def badge_on(cr, ch, p, s=1.0):
    """Hang the host badge on whoever is wearing it."""
    stage.host_badge(cr, p["x"], p["y"] - ch.hh * p["s"] * 0.95,
                     0.9 * p["s"] * s, math.sin(0) * 0.0)


def aud_positions(host):
    """The eight objects who are not hosting, in a row."""
    others = [n for n in FIELD if n != host]
    step = (AUD_X1 - AUD_X0) / max(1, len(others) - 1)
    return {n: AUD_X0 + i * step for i, n in enumerate(others)}


def sc_previously(cr, show, sc, beat, T):
    clips = {"h_prev1": (60.0, 6.0), "h_prev2": (140.0, 4.0),
             "h_prev3": (540.0, 4.0), "h_prev4": (500.0, 5.0)}
    t0, t1, act = show.act_span(sc, T)
    src, span = clips.get(act, clips["h_prev1"])
    lt = T - t0
    Tx = src + lt * (span / max(0.6, t1 - t0))
    ep = s2e01.EPISODE
    scx, beatx = ep.locate(Tx)
    cr.save()
    ep.fn[scx["key"]](cr, ep, scx, beatx, Tx)
    cr.restore()
    set_rgb(cr, (0.96, 0.80, 0.42), 0.10)
    cr.rectangle(0, 0, W, H)
    cr.fill()
    stage.vignette(cr, 0.45)
    stage.flash(cr, (1 - clamp(lt / 0.30)) * 0.85)
    from draw import rrect
    rrect(cr, 28, 26, 330, 46, 12)
    set_rgb(cr, (0.12, 0.11, 0.18), 0.85)
    cr.fill()
    text_at(cr, 193, 58, "PREVIOUSLY ON...", 26, (1, 0.86, 0.30), "center")


def sc_vote(cr, show, sc, beat, T):
    verdict = show.act_start(sc, "verdict")
    fling = show.act_start(sc, "fling")
    shut = show.act_start(sc, "slam_shut")
    shake = 0.0
    sl = show.since("slam", T, 0.6)
    if sl is not None and shut is not None and T > shut:
        shake = 9 * (1 - sl / 0.6)
    cr.save()
    camera(cr, 1.0, W / 2, H / 2, shake, T)
    stage.dark_stage(cr, T, spots=[(VOTE_X[n], 96, 1.0) for n in VOTE_X])
    gone = fling is not None and T > fling + 1.2
    for name in VOTE_X:
        x = VOTE_X[name]
        stage.podium(cr, x, GROUND + 10, 116, 120)
        if not (name == "Volt" and fling is not None and T > fling + 0.15):
            CAST[name].draw(cr, idle(name, T, y=GROUND + 4, x=x, s=0.7,
                                     expr=facial(beat, name, "flat"),
                                     mouth=speaks(show, beat, name, T),
                                     look=look_at(x, 1150)), T)
        ts = show.act_start(sc, "tally_" + name)
        if ts is not None and T > ts:
            k = ease_out(clamp((T - ts) / 0.9))
            col = CAST[name].tag
            if name == "Volt" and verdict is not None and T > verdict:
                col = (0.95, 0.30, 0.28) if int(T * 4) % 2 else (1, 0.75, 0.3)
            stage.scorecard(cr, x, 226, name,
                            "%d" % int(round(VOTES[name] * k)), col,
                            clamp((T - ts) / 0.35), w=140, size=34)
    if fling is not None and fling + 0.15 < T < fling + 1.2:
        f = clamp((T - fling - 0.15) / 1.0)
        CAST["Volt"].draw(cr, pose(lerp(VOTE_X["Volt"], VOTE_BOX_X, f),
                                   GROUND - math.sin(f * math.pi) * 250,
                                   rot=f * 6.0, expr="furious"), T)
    stage.cardboard_box(cr, VOTE_BOX_X, GROUND, 250, 150, "KITCHEN MISC")
    crew = BOXED if gone else [n for n in BOXED if n != "Volt"]
    for i, name in enumerate(crew):
        fx = VOTE_BOX_X - 100 + 200 * (i + 0.5) / max(1, len(crew))
        CAST[name].draw(cr, pose(fx, GROUND - 30, s=0.28,
                                 expr=facial(beat, name, "flat"),
                                 mouth=speaks(show, beat, name, T)), T)
    CAST["Mega"].draw(cr, idle("Mega", T, x=200, s=0.85,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(1, 0), flip=True), T)
    cr.restore()
    text_at(cr, W / 2, 66, "THE VOTE", 48, (1, 0.86, 0.30), "center",
            outline=(0.12, 0.11, 0.18), outline_w=10,
            alpha=clamp((T - sc["t0"]) / 0.6))
    stage.vignette(cr, 0.45)


def sc_title(cr, show, sc, beat, T):
    t = T - sc["t0"]
    set_rgb(cr, (0.30, 0.24, 0.40))
    cr.rectangle(0, 0, W, H)
    cr.fill()
    cr.save()
    cr.translate(W / 2, H / 2 - 20)
    for i in range(16):
        a = i / 16 * math.tau + t * 0.35
        cr.new_path()
        cr.move_to(0, 0)
        cr.line_to(math.cos(a) * 1100, math.sin(a) * 1100)
        cr.line_to(math.cos(a + 0.19) * 1100, math.sin(a + 0.19) * 1100)
        cr.close_path()
        set_rgb(cr, (1, 0.86, 0.30), 0.06)
        cr.fill()
    cr.restore()
    slam = show.cue_at["slam"][0] - sc["t0"]
    if t > slam - 0.5:
        k = clamp((t - slam + 0.45) / 0.55)
        stage.logo(cr, W / 2, 290, lerp(3.4, 1.0, ease_out(k)), 1.0,
                   sub='Series 2 — Episode 2: "The Host"'
                   if t > slam + 0.9 else None,
                   sub_a=clamp((t - slam - 0.9) / 0.5))
        stage.host_badge(cr, W / 2, 400, 1.6 * ease_back(
            clamp((t - slam - 1.3) / 0.6)))
    fl = show.since("slam", T, 0.35)
    if fl is not None:
        stage.flash(cr, (1 - fl / 0.35) * 0.55)
    for i, name in enumerate(FIELD):
        st = slam + 1.9 + i * 0.18
        if t < st:
            continue
        k = clamp((t - st) / 0.55)
        CAST[name].draw(cr, pose(150 + i * 128, GROUND + 120 - bounce(k) * 120,
                                 s=0.62, sq=1 + 0.12 * (1 - k)), T)


def sc_brief(cr, show, sc, beat, T):
    bt = show.act_start(sc, "h_badge")
    stage.garage(cr, T, spill=1.0)
    box_crew(cr, show, beat, T)
    stage.sign(cr, 1120, 244, "ON AIR", clamp((T - sc["t0"]) / 0.8))
    for name in FIELD:
        x = BRIEF_X[name]
        p = idle(name, T, x=x, s=0.66, expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T), look=look_at(x, 1180))
        if name == "Fuzz":
            p["y"] -= abs(math.sin(T * 5)) * 26
        CAST[name].draw(cr, p, T)
    mp = idle("Mega", T, x=1180, s=0.95, expr=facial(beat, "Mega", "smug"),
              mouth=speaks(show, beat, "Mega", T), look=(-1, 0),
              arm_l=1.2 if bt is not None and T > bt else 0.0)
    CAST["Mega"].draw(cr, mp, T)
    if bt is not None and T > bt:
        k = ease_back(clamp((T - bt) / 0.6))
        stage.host_badge(cr, 1120, 300, 1.5 * k, math.sin(T * 1.4) * 0.08)


def sc_auditions(cr, show, sc, beat, T):
    t0, t1, act = show.act_span(sc, T)
    host = None
    for name in ORDER:
        st = show.act_start(sc, "h_a_" + name)
        if st is not None and T >= st:
            host = name
    if act == "h_buzz":
        host = "Cone"
    elif act in ("h_flicker", "h_lit"):
        host = "Bulb"
    elif act == "h_sad":
        host = "Gloss"
    elif act == "h_measure":
        host = "Reel"
    elif act == "h_clap":
        host = "Mugsy"
    host = host or "Spanner"

    dark = act == "h_flicker"
    light = 1.0
    if dark:
        light = 0.2 if int((T - t0) * 3.5) % 2 == 0 else 0.9

    stage.garage(cr, T, light=light, spill=1.0)
    box_crew(cr, show, beat, T)
    stage.sign(cr, 1120, 244, "ON AIR", 1.0)
    ap = show.since("applause", T, 2.0)
    if ap is not None:
        stage.sign(cr, 1108, 336, "APPLAUSE", 1 - ap / 2.0,
                   (0.20, 0.52, 0.30), 280)
    stage.crate(cr, CRATE_X, GROUND)

    hp = idle(host, T, y=GROUND - CRATE_H, x=CRATE_X, s=0.92,
              expr=facial(beat, host), mouth=speaks(show, beat, host, T),
              look=(1, 0))
    if host == "Fuzz":
        hp["y"] -= abs(math.sin(T * 3.4)) * 330
    if host == "Gloss" and act == "h_sad":
        hp["expr"] = beat["expr"] if talker(beat, "Gloss") else "sad"
    CAST[host].draw(cr, hp, T)
    badge_on(cr, CAST[host], hp)

    xs = aud_positions(host)
    for name, x in xs.items():
        p = idle(name, T, x=x, s=0.5, expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T), look=(-1, 0))
        if name == "Fuzz":
            p["y"] -= abs(math.sin(T * 5.2)) * 34
        if act == "h_sad" and name in ("Reel", "Sticky", "Mugsy"):
            p["expr"] = beat["expr"] if talker(beat, name) else "sad"
        CAST[name].draw(cr, p, T)
        if act == "h_sad" and name in ("Reel", "Sticky"):
            tears(cr, x, p["y"] - 60, 0.5, T, name)
    if act == "h_sad":
        tears(cr, hp["x"], hp["y"] - 96, 0.9, T, "gloss")

    CAST["Mega"].draw(cr, idle("Mega", T, x=MEGA_X, s=0.78,
                               expr=facial(beat, "Mega", "flat"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)

    # per-host visual business
    st = show.act_start(sc, "h_a_" + host) or t0
    if host == "Cone":
        n = min(len(RULES), int((T - st) / 2.6))
        for i in range(n):
            text_at(cr, 1240, 200 + i * 34, RULES[i], 22, (1, 0.95, 0.85),
                    "right", outline=(0.20, 0.16, 0.12), outline_w=5)
    if host == "Clip":
        if int(T * 1.2) % 2 == 0:
            stage.banner(cr, 40, "COMING UP", 1.0, (0.83, 0.21, 0.27))
    if host == "Bulb":
        i = min(len(FORMATS) - 1, int((T - st) / 3.4))
        text_at(cr, 860, 214, FORMATS[i], 42, (1, 0.95, 0.6), "center",
                outline=(0.20, 0.16, 0.12), outline_w=9)
    if host == "Reel" and act == "h_measure":
        k = ease_out(clamp((T - show.act_start(sc, "h_measure")) / 1.6))
        y = 300
        cr.new_path()
        cr.move_to(80, y)
        cr.line_to(lerp(80, 1200, k), y)
        from draw import stroke_out as so
        so(cr, 5.0, (0.95, 0.52, 0.18))
        text_at(cr, 640, y - 16, "6.00 m", 26, (1, 0.9, 0.6), "center",
                outline=(0.20, 0.16, 0.12), outline_w=6, alpha=k)
    if host == "Spanner" and T < st + 6:
        text_at(cr, 640, 200, "19 SECONDS", 40, (1, 1, 1), "center",
                outline=(0.42, 0.46, 0.54), outline_w=8,
                alpha=clamp((T - st - 3.0) / 0.5))
    if host == "Sticky":
        for name, x in xs.items():
            text_at(cr, x, GROUND - 92, "SAFE", 16, (0.4, 0.9, 0.5),
                    "center", outline=(0.12, 0.11, 0.18), outline_w=4)
    if dark:
        stage.vignette(cr, 0.55)
    text_at(cr, 60, 60, "AUDITION %d / 9" % (ORDER.index(host) + 1), 26,
            (1, 0.86, 0.30), "left", outline=(0.20, 0.16, 0.12),
            outline_w=6)


def sc_judging2(cr, show, sc, beat, T):
    rig = show.act_start(sc, "h_rig")
    st = show.act_start(sc, "h_score")
    stage.garage(cr, T, spill=1.0)
    box_crew(cr, show, beat, T)
    for i, name in enumerate(FIELD):
        x = 300 + i * 100
        CAST[name].draw(cr, idle(name, T, x=x, s=0.6,
                                 expr=facial(beat, name),
                                 mouth=speaks(show, beat, name, T),
                                 look=(1, 0)), T)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1180, s=0.95,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    for i, name in enumerate(ORDER):
        gx, gy = SCORE_GRID[i]
        k = clamp((T - (st or sc["t0"]) - 2.0 - i * 3.4) / 0.4)
        if k <= 0:
            continue
        score = SCORES[name]
        col = CAST[name].tag
        if name == "Mugsy" and rig is not None and T > rig:
            if T < rig + 9.0:
                score = 9
            elif T < rig + 17.0:
                score = 4
                col = (0.95, 0.30, 0.28)
            else:
                score = 9
                col = (0.30, 0.75, 0.42)
        stage.scorecard(cr, gx, gy, name, str(score), col, k, w=190, size=40)
    if rig is not None and rig + 9.0 < T < rig + 17.0:
        text_at(cr, W / 2, 96, "RIGGED", 52, (0.95, 0.30, 0.28), "center",
                outline=(0.12, 0.11, 0.18), outline_w=10,
                alpha=0.5 + 0.5 * math.sin(T * 8))


def sc_winner2(cr, show, sc, beat, T):
    st = show.act_start(sc, "h_win", sc["t0"])
    stage.garage(cr, T, spill=1.0)
    box_crew(cr, show, beat, T)
    stage.sign(cr, 1108, 336, "APPLAUSE", 1.0, (0.20, 0.52, 0.30), 280)
    for i, name in enumerate([n for n in FIELD if n != "Mugsy"]):
        x = 260 + i * 84
        CAST[name].draw(cr, idle(name, T, x=x, s=0.58,
                                 expr=facial(beat, name, "beam"),
                                 mouth=speaks(show, beat, name, T),
                                 look=(1, 0)), T)
    mp = idle("Mugsy", T, x=950, s=1.0, expr=facial(beat, "Mugsy", "beam"),
              mouth=speaks(show, beat, "Mugsy", T), look=(1, 0))
    mp["y"] -= abs(math.sin((T - st) * 4)) * 12
    CAST["Mugsy"].draw(cr, mp, T)
    badge_on(cr, CAST["Mugsy"], mp)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1120, s=0.95,
                               expr=facial(beat, "Mega", "angry"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    stage.confetti(cr, T - st, 60)
    stage.banner(cr, 38, "MUGSY WINS IMMUNITY", clamp((T - st) / 0.4),
                 (0.31, 0.55, 0.86))


def sc_elimination(cr, show, sc, beat, T):
    votes = show.act_start(sc, "votes")
    stage.dark_stage(cr, T, spots=[(ELIM_X[n], 110, 1.0) for n in NOMINEES])
    box_crew(cr, show, beat, T, x=110, w=200, scale=0.24)
    for name in NOMINEES:
        x = ELIM_X[name]
        stage.podium(cr, x, GROUND + 10, 124, 120)
        CAST[name].draw(cr, idle(name, T, y=GROUND + 4, x=x, s=0.74,
                                 expr=facial(beat, name, "flat"),
                                 mouth=speaks(show, beat, name, T),
                                 look=look_at(x, 1200)), T)
        if votes is not None and T > votes:
            k = clamp((T - votes - NOMINEES.index(name) * 0.18) / 0.4)
            stage.scorecard(cr, x, 292, name, "vote", CAST[name].tag, k,
                            w=164, size=30)
    mp = idle("Mugsy", T, x=1080, s=0.7, expr=facial(beat, "Mugsy", "beam"),
              mouth=speaks(show, beat, "Mugsy", T), look=(-1, 0))
    CAST["Mugsy"].draw(cr, mp, T)
    badge_on(cr, CAST["Mugsy"], mp)
    text_at(cr, 1080, GROUND - 122, "SAFE", 20, (0.4, 0.9, 0.5), "center",
            outline=(0.12, 0.11, 0.18), outline_w=5)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1210, s=0.85,
                               expr=facial(beat, "Mega", "angry"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    text_at(cr, W / 2, 66, "ELIMINATION", 48, (1, 0.86, 0.30), "center",
            outline=(0.12, 0.11, 0.18), outline_w=10,
            alpha=clamp((T - sc["t0"]) / 0.6))
    if votes is not None and T > votes:
        text_at(cr, W / 2, 112, "vote in the comments", 26, (1, 1, 1),
                "center", bold=False, alpha=clamp((T - votes) / 0.5))
    stage.vignette(cr, 0.45)


def sc_outro(cr, show, sc, beat, T):
    end = show.act_start(sc, "endcard", sc["t1"])
    mow = show.act_start(sc, "h_mower")
    if T < end:
        t = T - sc["t0"]
        shake = 0.0
        if mow is not None and T > mow + 0.8:
            shake = 3.0 * clamp((T - mow - 0.8) / 1.2)
        cr.save()
        camera(cr, 1.0, W / 2, H / 2, shake, T)
        stage.garage(cr, T, light=0.35, spill=1.0)
        box_crew(cr, show, beat, T)
        s2e01.lawnmower(cr, 900, GROUND, 1.0, T)
        if mow is not None and T > mow + 0.8:
            glow_eyes(cr, 830, GROUND - 120, 1.4, 30, (0.99, 0.62, 0.25),
                      0.4 + 0.5 * abs(math.sin(T * 7)))
        for i, name in enumerate(["Mugsy", "Cone", "Spanner"]):
            CAST[name].draw(cr, idle(name, T, x=330 + i * 110, s=0.7,
                                     expr=facial(beat, name, "shock"),
                                     mouth=speaks(show, beat, name, T),
                                     look=(1, 0)), T)
        CAST["Mega"].draw(cr, idle("Mega", T, x=200, s=0.85,
                                   expr=facial(beat, "Mega", "worried"),
                                   mouth=speaks(show, beat, "Mega", T),
                                   look=(1, 0), flip=True), T)
        cr.restore()
        text_at(cr, W / 2, 96, "NEXT TIME ON", 36, (1, 1, 1), "center",
                outline=(0.12, 0.11, 0.18), outline_w=8, alpha=clamp(t / 0.5))
        stage.logo(cr, W / 2, 176, 0.56, clamp(t / 0.5))
        stage.vignette(cr, 0.5)
    else:
        t = T - end
        stage.dark_stage(cr, T, spots=[(640, 280, 0.8)])
        stage.logo(cr, W / 2, 250, lerp(1.25, 1.0, ease_out(clamp(t / 0.8))),
                   1.0, sub='Series 2 — Episode 3: "The Lawnmower"',
                   sub_a=clamp((t - 0.7) / 0.6))
        for i, name in enumerate(FIELD):
            st = 0.4 + i * 0.12
            if t < st:
                continue
            k = clamp((t - st) / 0.5)
            CAST[name].draw(cr, pose(150 + i * 128,
                                     GROUND + 120 - bounce(k) * 120,
                                     s=0.62), T)
        text_at(cr, W / 2, 396, "VOTE IN THE COMMENTS", 28, (1, 1, 1),
                "center", alpha=clamp((t - 1.3) / 0.6))
        stage.vignette(cr, 0.4)


SCENE_FN = {
    "previously": sc_previously, "vote": sc_vote, "title": sc_title,
    "brief": sc_brief, "auditions": sc_auditions, "judging2": sc_judging2,
    "winner2": sc_winner2, "elimination": sc_elimination, "outro": sc_outro,
}

EPISODE = Show("s2e02", 'Series 2, Episode 2: "The Host"', BEATS, TOTAL,
               SCENE_FN)
