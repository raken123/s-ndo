"""Odds & Ends, series 2, episode 1: "The Garage".

The kitchen is being renovated.  The drawer has become a box, the box is in
the garage, and the garage has objects of its own.  Twelve minutes.
"""

import math

import ep01
import ep02
import ep03
import ep04
import ep05
import ep06
import ep07
import ep08
import stage
from cast import CAST, hand_pos, pose
from draw import (GROUND, H, W, bounce, clamp, ease_back, ease_in_out,
                  ease_out, lerp, rand01, set_rgb, text_at)
from engine import (Show, camera, facial, glow_eyes, idle, look_at,
                    silhouette, speaks, talker)
from timeline import A, S

TOTAL = 720.0
NEW = ["Spanner", "Bulb", "Fuzz", "Gloss", "Reel"]
BACK = ["Mugsy", "Cone", "Volt", "Sticky", "Clip"]
BOX = ["Cube", "Mitt", "Plate", "Spork"]
SHARP = ["Spanner", "Cone", "Volt", "Clip", "Bulb"]
SOFT = ["Mugsy", "Sticky", "Fuzz", "Gloss", "Reel"]
NOMINEES = SHARP


BEATS = [
    dict(key="previously", beats=[
        A(1.6, "g_prev1"),
        S("Mega", "Previously, on Odds and Ends:", "smug", act="g_prev1"),
        S("Mega", "six objects stacked themselves for a chair.", "happy",
          act="g_prev1"),
        S("Mega", "A drawer filled up.", "flat", act="g_prev2"),
        S("Mega", "A sock happened.", "flat", act="g_prev3"),
        S("Mega", "A bin came for the paper.", "smug", act="g_prev4"),
        S("Mega", "The dishwasher gave us three more.", "happy", act="g_prev5"),
        S("Mega", "Something froze to a shelf.", "flat", act="g_prev6"),
        S("Mega", "A cone found his purpose.", "smug", act="g_prev7"),
        S("Mega", "And a mug won a chair that wobbles.", "happy",
          act="g_prev8"),
        A(3.0, "g_prev8"),
    ]),

    dict(key="box", beats=[
        A(3.0, "g_dim"),
        S("Volt", "Where are we.", "flat", act="g_dim"),
        S("Plate", "It is a box. We have been boxed.", "sly", act="g_dim"),
        S("Cube", "It is cold. Whoever did this: thank you.", "beam",
          act="g_dim"),
        S("Sticky", "It says FRAGILE on the side! That is us!", "beam",
          act="g_dim"),
        S("Clip", "It says KITCHEN MISC.", "flat", act="g_dim"),
        S("Mitt", "We are miscellaneous now. That is fine. That is a family.",
          "beam", act="g_dim"),
        S("Spork", "Why is there a lawnmower looking at me.", "worried",
          act="g_dim"),
        S("Cube", "The lawnmower is fine. The lawnmower is my friend.", "beam",
          act="g_dim"),
        S("Mugsy", "I won a chair. Why am I in a box WITH the chair.", "flat",
          act="g_dim"),
        S("Cone", "Because the humans are renovating. The kitchen is "
          "infrastructure.", "flat", act="g_dim"),
        S("Volt", "Do not say infrastructure.", "angry", act="g_dim"),
        S("Cone", "It is my word now.", "smug", act="g_dim"),
        S("Volt", "It was never a word you were ALLOWED.", "furious",
          act="g_dim"),
        A(2.0, "g_light"),
        S("Mega", "Good morning, box!", "happy", act="g_light"),
        S("Volt", "Oh no.", "shock", act="g_light"),
        S("Mega", "Welcome to the garage. Welcome to SERIES TWO.", "smug",
          act="g_light"),
        S("Mugsy", "I am retired.", "flat", act="g_light"),
        S("Mega", "You won a chair.", "smug", act="g_light"),
        S("Mugsy", "I won a chair.", "flat", act="g_light"),
        S("Mega", "The chair is in the box.", "smug", act="g_light"),
        S("Mugsy", "...The chair is in the box.", "sad", act="g_light"),
        A(2.4, "g_lit"),
    ]),

    dict(key="title", beats=[
        A(9.0, "logo"),
    ]),

    dict(key="meet", beats=[
        A(2.4, "g_garage"),
        S("Mega", "The garage has its own objects. They have been here a "
          "long time.", "smug", act="g_garage"),
        S("Mega", "They have opinions.", "flat", act="g_garage"),
        A(1.4, "g_meet_Spanner"),
        S("Spanner", "Spanner.", "flat", act="g_meet_Spanner"),
        S("Mega", "The wrench.", "happy", act="g_meet_Spanner"),
        S("Spanner", "Spanner.", "flat", act="g_meet_Spanner"),
        S("Mega", "Is there a difference?", "smug", act="g_meet_Spanner"),
        S("Spanner", "There is an ocean.", "angry", act="g_meet_Spanner"),
        S("Mega", "Noted. Wrench.", "smug", act="g_meet_Spanner"),
        S("Spanner", "I will end you.", "furious", act="g_meet_Spanner"),
        S("Spanner", "I have fixed things you have not heard of.", "flat",
          act="g_meet_Spanner"),
        S("Mega", "Like?", "flat", act="g_meet_Spanner"),
        S("Spanner", "A hinge. In 2011. It still works.", "smug",
          act="g_meet_Spanner"),
        A(1.4, "g_meet_Bulb"),
        S("Bulb", "Hello! I am Bulb! I have an idea!", "starry",
          act="g_meet_Bulb"),
        S("Mega", "Already?", "flat", act="g_meet_Bulb"),
        S("Bulb", "We put the car... on the ROOF.", "starry",
          act="g_meet_Bulb"),
        S("Mega", "Why.", "flat", act="g_meet_Bulb"),
        S("Bulb", "So there is more garage.", "beam", act="g_meet_Bulb"),
        S("Mega", "...Moving on.", "flat", act="g_meet_Bulb"),
        S("Bulb", "I have another one!", "starry", act="g_meet_Bulb"),
        S("Mega", "No.", "flat", act="g_meet_Bulb"),
        A(1.4, "g_meet_Fuzz"),
        S("Fuzz", "HI I am Fuzz I am a tennis ball I have been under the car "
          "for three years is the dog still alive?", "shock",
          act="g_meet_Fuzz"),
        S("Mega", "The dog is fine.", "flat", act="g_meet_Fuzz"),
        S("Fuzz", "Is the dog HERE?", "shock", act="g_meet_Fuzz"),
        S("Mega", "The dog is not here.", "flat", act="g_meet_Fuzz"),
        S("Fuzz", "Okay. Okay. I will bounce anyway. For safety.", "worried",
          act="g_meet_Fuzz"),
        S("Mega", "That is not how safety—", "flat", act="g_meet_Fuzz"),
        S("Fuzz", "BOUNCING.", "beam", act="g_meet_Fuzz"),
        A(1.4, "g_meet_Gloss"),
        S("Gloss", "I am Gloss. I am magnolia.", "smug", act="g_meet_Gloss"),
        S("Mega", "Is that a colour or a personality?", "smug",
          act="g_meet_Gloss"),
        S("Gloss", "It is a burden.", "sad", act="g_meet_Gloss"),
        S("Gloss", "They painted the hallway with me. Then they said it "
          "looked 'a bit beige.'", "worried", act="g_meet_Gloss"),
        S("Gloss", "A BIT BEIGE. I am WARM CREAM.", "furious",
          act="g_meet_Gloss"),
        S("Mega", "You seem upset.", "flat", act="g_meet_Gloss"),
        S("Gloss", "I have never not been upset.", "sad", act="g_meet_Gloss"),
        A(1.4, "g_meet_Reel"),
        S("Reel", "Reel. Extension lead. Twelve metres.", "worried",
          act="g_meet_Reel"),
        S("Mega", "You do not have to tell everyone the metres.", "flat",
          act="g_meet_Reel"),
        S("Reel", "People ask. Then they unwind me. Then they do not wind me "
          "back.", "sad", act="g_meet_Reel"),
        S("Reel", "I have been half unwound since 2019.", "worried",
          act="g_meet_Reel"),
        S("Mega", "That sounds hard.", "flat", act="g_meet_Reel"),
        S("Reel", "It is not hard. It is TANGLED. There is a difference, and "
          "the difference is me.", "shock", act="g_meet_Reel"),
        A(1.6, "g_lineup"),
        S("Mega", "Five garage objects. Which is not enough for a show.",
          "flat", act="g_lineup"),
        S("Spanner", "Six was enough last time.", "flat", act="g_lineup"),
        S("Mega", "Six was BARELY enough last time. We have discussed this.",
          "angry", act="g_lineup"),
        A(2.0, "g_lineup"),
    ]),

    dict(key="returnees", beats=[
        S("Mega", "So I am bringing five back from the box.", "smug",
          act="g_back"),
        A(1.6, "g_back"),
        S("Volt", "Pick me. PICK ME. I have been in a drawer for seven "
          "episodes.", "shock", act="g_back"),
        S("Mega", "Volt.", "smug", act="g_back_Volt"),
        S("Volt", "YES.", "starry", act="g_back_Volt"),
        S("Mega", "Because the audience enjoys watching you lose.", "smug",
          act="g_back_Volt"),
        S("Volt", "...I will take it.", "flat", act="g_back_Volt"),
        S("Mega", "Sticky.", "happy", act="g_back_Sticky"),
        S("Sticky", "Yay! Is Volt coming? Volt is coming!", "beam",
          act="g_back_Sticky"),
        S("Volt", "Please not with—", "worried", act="g_back_Sticky"),
        S("Sticky", "We are a TEAM!", "beam", act="g_back_Sticky"),
        S("Mega", "You are not, actually. But we will get there.", "smug",
          act="g_back_Sticky"),
        S("Mega", "Clip.", "happy", act="g_back_Clip"),
        S("Clip", "Finally. A platform. Do I have notes? I have SO many "
          "notes.", "smug", act="g_back_Clip"),
        S("Clip", "Note one: the box has no acoustics.", "smug",
          act="g_back_Clip"),
        S("Mega", "Cone.", "flat", act="g_back_Cone"),
        S("Cone", "Infrastructure reporting.", "smug", act="g_back_Cone"),
        S("Volt", "STOP.", "furious", act="g_back_Cone"),
        S("Mega", "And our reigning champion.", "smug", act="g_back_Mugsy"),
        S("Mugsy", "No.", "flat", act="g_back_Mugsy"),
        S("Mega", "Mugsy.", "smug", act="g_back_Mugsy"),
        S("Mugsy", "I said no.", "flat", act="g_back_Mugsy"),
        S("Mega", "It is in your contract.", "smug", act="g_back_Mugsy"),
        S("Mugsy", "I do not have a contract.", "worried", act="g_back_Mugsy"),
        S("Mega", "It is in the chair.", "smug", act="g_back_Mugsy"),
        S("Mugsy", "...What is in the chair?", "shock", act="g_back_Mugsy"),
        S("Mega", "Your contract. It is under the seat. It is why it wobbles.",
          "smug", act="g_back_Mugsy"),
        S("Mugsy", "THAT is why it wobbles?", "shock", act="g_back_Mugsy"),
        S("Plate", "Take him. He complains about the box.", "sly",
          act="g_boxcomment"),
        S("Cube", "I would like to stay. It is cold.", "beam",
          act="g_boxcomment"),
        S("Mitt", "We will be here. Being miscellaneous.", "beam",
          act="g_boxcomment"),
        S("Spork", "Can someone move the lawnmower.", "worried",
          act="g_boxcomment"),
        A(2.0, "g_boxcomment"),
    ]),

    dict(key="teams", beats=[
        S("Mega", "Ten objects. Two teams. Captains: Spanner and Mugsy.",
          "smug", act="g_teams"),
        S("Mugsy", "Why me?", "worried", act="g_teams"),
        S("Mega", "You are the champion.", "smug", act="g_teams"),
        S("Mugsy", "I hid behind a cone.", "flat", act="g_teams"),
        S("Mega", "Championly.", "smug", act="g_teams"),
        A(1.2, "g_pick"),
        S("Spanner", "I pick Cone.", "flat", act="g_pick"),
        S("Cone", "Infrastructure has been picked.", "smug", act="g_pick"),
        S("Mugsy", "I pick... Sticky. She is nice.", "flat", act="g_pick"),
        S("Sticky", "I AM NICE!", "beam", act="g_pick"),
        S("Spanner", "Volt.", "flat", act="g_pick"),
        S("Volt", "Correct choice. Finally, competence.", "smug", act="g_pick"),
        S("Spanner", "You are a battery.", "flat", act="g_pick"),
        S("Volt", "I am a POWER SOURCE.", "furious", act="g_pick"),
        S("Mugsy", "Fuzz, I suppose?", "flat", act="g_pick"),
        S("Fuzz", "YES. Okay. What is the team? Where is the team? I am "
          "bouncing.", "beam", act="g_pick"),
        S("Spanner", "Clip.", "flat", act="g_pick"),
        S("Clip", "Obviously.", "smug", act="g_pick"),
        S("Mugsy", "That leaves Gloss, Reel and Bulb.", "flat", act="g_pick"),
        S("Bulb", "I have an idea about who you should pick!", "starry",
          act="g_pick"),
        S("Mugsy", "Gloss. Reel.", "flat", act="g_pick"),
        S("Bulb", "It was me. The idea was me.", "sad", act="g_pick"),
        S("Spanner", "Fine. Bulb.", "flat", act="g_pick"),
        S("Bulb", "I am on a TEAM. This is the best idea I have ever had.",
          "starry", act="g_pick"),
        S("Mega", "You may not trade.", "flat", act="g_pick"),
        S("Spanner", "I would like to trade Bulb.", "flat", act="g_pick"),
        S("Mega", "You may not trade.", "flat", act="g_pick"),
        A(1.4, "g_names"),
        S("Mega", "Team names.", "smug", act="g_names"),
        S("Spanner", "Sharp Objects.", "flat", act="g_names"),
        S("Mega", "Bulb is not sharp.", "flat", act="g_names"),
        S("Spanner", "Bulb is a liability. He is sharp when he breaks.", "flat",
          act="g_names"),
        S("Bulb", "I have been called worse! ...No, I have not.", "worried",
          act="g_names"),
        S("Mugsy", "Soft Objects?", "worried", act="g_names"),
        S("Gloss", "I am NOT soft. I am a TIN.", "furious", act="g_names"),
        S("Mugsy", "Soft Objects.", "flat", act="g_names"),
        S("Mega", "Sharp Objects versus Soft Objects. Good. Terrible. "
          "Perfect.", "smug", act="g_names"),
        A(2.0, "g_names"),
    ]),

    dict(key="climb", beats=[
        S("Mega", "Today's challenge: THE SHELF.", "happy", act="g_brief"),
        S("Mega", "The top shelf. The high one. Where the good screws are.",
          "smug", act="g_brief"),
        S("Spanner", "Nobody has reached the top shelf. Not even the human.",
          "flat", act="g_brief"),
        S("Mega", "First team to get one member onto it wins.", "happy",
          act="g_brief"),
        S("Reel", "How high is it?", "worried", act="g_brief"),
        S("Mega", "You tell me, Reel.", "smug", act="g_brief"),
        S("Reel", "Four metres. I have measured it. I measure everything. It "
          "is a compulsion.", "worried", act="g_brief"),
        S("Mega", "Go.", "flat", act="g_go"),
        A(3.0, "g_go"),
        S("Spanner", "Ladder. There is a ladder. We use the ladder.", "flat",
          act="g_ladder"),
        S("Bulb", "I have an idea—", "starry", act="g_ladder"),
        S("Spanner", "We use the LADDER.", "angry", act="g_ladder"),
        A(2.4, "g_ladder"),
        S("Cone", "I will hold the base. I am structurally the base. That is "
          "from episode one.", "smug", act="g_ladder"),
        S("Volt", "Nobody remembers episode one.", "flat", act="g_ladder"),
        S("Cone", "I remember every episode. I have nothing else.", "sad",
          act="g_ladder"),
        A(2.2, "g_plan"),
        S("Mugsy", "Okay. Team. Ideas.", "worried", act="g_plan"),
        S("Fuzz", "I bounce up!", "beam", act="g_plan"),
        S("Mugsy", "You cannot stop.", "flat", act="g_plan"),
        S("Fuzz", "I bounce up and I DO NOT stop! That is the plan!", "starry",
          act="g_plan"),
        S("Gloss", "I could paint the shelf so it looks lower.", "smug",
          act="g_plan"),
        S("Reel", "You could... unwind me. Throw the plug over. Climb me.",
          "worried", act="g_plan"),
        S("Mugsy", "Reel, are you okay with that?", "worried", act="g_plan"),
        S("Reel", "No. But it is a plan. Nobody has ever had a plan for me "
          "before.", "sad", act="g_plan"),
        S("Sticky", "I will stick to whoever is climbing!", "beam",
          act="g_plan"),
        S("Mugsy", "That is not helping.", "flat", act="g_plan"),
        S("Sticky", "It is HELPING.", "beam", act="g_plan"),
        A(2.4, "g_climb1"),
        S("Clip", "I am on the ladder. I am climbing. I am a natural.", "smug",
          act="g_climb1"),
        S("Volt", "You are clipped to the ladder.", "flat", act="g_climb1"),
        S("Clip", "That is climbing with commitment.", "smug", act="g_climb1"),
        S("Cone", "The base is stable. I am the base.", "smug", act="g_climb1"),
        S("Bulb", "IDEA. If I screw myself into the light socket up there—",
          "starry", act="g_climb1"),
        S("Spanner", "No.", "flat", act="g_climb1"),
        S("Bulb", "—I would technically be on the CEILING, which is HIGHER "
          "than the shelf.", "starry", act="g_climb1"),
        S("Spanner", "...That is not the rule.", "flat", act="g_climb1"),
        S("Mega", "It is not the rule.", "flat", act="g_climb1"),
        S("Bulb", "It is a great idea, though.", "beam", act="g_climb1"),
        S("Mega", "It is a great idea.", "flat", act="g_climb1"),
        A(3.0, "g_rope"),
        S("Reel", "Oh. Oh no. There goes six metres. There goes eight.",
          "shock", act="g_rope"),
        A(2.6, "g_bounce"),
        S("Fuzz", "I AM GOING UP!", "starry", act="g_bounce"),
        A(2.0, "g_bounce"),
        S("Fuzz", "I AM GOING PAST!", "shock", act="g_bounce"),
        S("Mugsy", "Fuzz! Grab the shelf!", "shock", act="g_bounce"),
        S("Fuzz", "I DO NOT HAVE HANDS ON THE WAY UP.", "shock",
          act="g_bounce"),
        A(2.4, "g_spill"),
        S("Gloss", "I have been knocked. I am tipping. I am — oh, I am going.",
          "shock", act="g_spill"),
        A(2.2, "g_spill"),
        S("Gloss", "MAGNOLIA EVERYWHERE. LOOK AT IT. WARM CREAM ON "
          "EVERYTHING.", "furious", act="g_spilled"),
        S("Volt", "It looks a bit beige.", "sly", act="g_spilled"),
        S("Gloss", "I WILL FIND YOU.", "furious", act="g_spilled"),
        A(2.0, "g_climb2"),
        S("Clip", "Nearly there! I can see the good screws!", "starry",
          act="g_climb2"),
        S("Spanner", "Do not look at the screws. Look at the shelf.", "flat",
          act="g_climb2"),
        S("Clip", "They are SO good, though.", "starry", act="g_climb2"),
        S("Bulb", "I have had another idea and I think it has used up my—",
          "dizzy", act="g_climb2"),
        A(3.2, "g_dark"),
        S("Mega", "The light has gone.", "flat", act="g_dark"),
        S("Bulb", "That is me. Sorry. Thinking.", "worried", act="g_dark"),
        S("Sticky", "I cannot see who I am stuck to!", "shock", act="g_dark"),
        S("Volt", "It is me. It is always me.", "flat", act="g_dark"),
        A(2.4, "g_lightback"),
        S("Bulb", "Better. I have stopped thinking.", "beam",
          act="g_lightback"),
        A(2.2, "g_climb3"),
        S("Reel", "Somebody is climbing me. Somebody is actually climbing me.",
          "shock", act="g_climb3"),
        S("Mugsy", "I am sorry. I am sorry. I am a mug. Mugs do not climb.",
          "worried", act="g_climb3"),
        S("Reel", "You are doing fine! You are doing— ow. Handle.", "worried",
          act="g_climb3"),
        S("Volt", "Why is the mug climbing a cable.", "flat", act="g_climb3"),
        S("Cone", "Because nobody has stopped him. That is how most things "
          "happen.", "flat", act="g_climb3"),
        S("Clip", "I am AT the shelf! I am ON—", "starry", act="g_climb3"),
        S("Mega", "You are clipped to the ladder.", "flat", act="g_climb3"),
        S("Clip", "Yes.", "flat", act="g_climb3"),
        S("Mega", "The ladder is not the shelf.", "flat", act="g_climb3"),
        S("Clip", "It is ADJACENT to the shelf.", "angry", act="g_climb3"),
        S("Cone", "Objection: adjacency has never counted—", "flat",
          act="g_crash"),
        A(3.6, "g_crash"),
        S("Spanner", "CONE. THE BASE.", "furious", act="g_crash"),
        S("Cone", "I was making a legal point.", "flat", act="g_crash"),
        A(2.4, "g_crash"),
        S("Mugsy", "I am near it. I am near the shelf. I need six more "
          "inches.", "worried", act="g_reach"),
        S("Sticky", "I have got you!", "beam", act="g_reach"),
        S("Mugsy", "You are stuck to me. That is not the same as having me.",
          "flat", act="g_reach"),
        S("Fuzz", "INCOMING—", "shock", act="g_top"),
        A(3.2, "g_top"),
        S("Mugsy", "...I am on it.", "shock", act="g_top"),
        S("Mugsy", "I am on the shelf. I am on the top shelf.", "starry",
          act="g_top"),
        S("Mega", "SOFT OBJECTS WIN!", "happy", act="g_top"),
        S("Reel", "Can someone wind me back up now? Anyone?", "worried",
          act="g_top"),
        A(3.0, "g_top"),
    ]),

    dict(key="results", beats=[
        A(2.0, "g_score"),
        S("Mega", "Soft Objects reached the top shelf. By accident. Which "
          "counts.", "smug", act="g_score"),
        S("Mugsy", "I would like to come down.", "worried", act="g_score"),
        S("Mega", "Later.", "flat", act="g_score"),
        S("Mega", "Sharp Objects reached... the floor. From a height.", "smug",
          act="g_score"),
        S("Spanner", "We had the ladder.", "flat", act="g_score"),
        S("Mega", "You had the ladder, and Cone had a legal point.", "smug",
          act="g_score"),
        S("Cone", "Adjacency has never counted. I stand by it. From the "
          "floor.", "flat", act="g_score"),
        S("Volt", "Seven episodes in a drawer. One episode out. And I am "
          "losing again.", "sad", act="g_score"),
        S("Clip", "Technically I was the highest object at the moment of—",
          "smug", act="g_score"),
        S("Mega", "You were clipped to a falling ladder.", "flat",
          act="g_score"),
        S("Clip", "At a great height.", "smug", act="g_score"),
        S("Mega", "Soft Objects are safe. Sharp Objects: elimination.",
          "happy", act="win"),
        S("Bulb", "I have an idea about the vote!", "starry", act="win"),
        S("Spanner", "Bulb.", "flat", act="win"),
        S("Bulb", "Sorry.", "sad", act="win"),
        A(2.0, "win"),
    ]),

    dict(key="elimination", beats=[
        A(2.6, "stage2"),
        S("Mega", "Spanner. Cone. Volt. Clip. Bulb. One of you goes back in "
          "the box.", "smug", act="podium"),
        S("Volt", "The BOX? I just LEFT the box!", "furious", act="podium"),
        S("Mega", "The box will be delighted.", "smug", act="podium"),
        S("Plate", "The box will not be delighted.", "sly", act="podium"),
        S("Cone", "I move that adjacency be counted retroactively.", "flat",
          act="podium"),
        S("Mega", "Denied.", "flat", act="podium"),
        S("Cone", "I move that it be counted proactively.", "flat",
          act="podium"),
        S("Mega", "That is not a thing.", "flat", act="podium"),
        S("Cone", "It is infrastructure.", "smug", act="podium"),
        S("Volt", "I am BEGGING you.", "furious", act="podium"),
        S("Spanner", "Vote for the wrench, and I will know.", "angry",
          act="podium"),
        S("Mega", "You will know because it is a vote.", "flat", act="podium"),
        S("Spanner", "I will know it in my HEART.", "furious", act="podium"),
        S("Bulb", "I would like to say something.", "worried", act="podium"),
        S("Mega", "Is it an idea?", "flat", act="podium"),
        S("Bulb", "...It is sort of an idea.", "worried", act="podium"),
        A(1.4, "votes"),
        S("Mega", "Vote in the comments. Soft Objects, get Mugsy off the "
          "shelf.", "happy", act="votes"),
        S("Mugsy", "PLEASE.", "shock", act="votes"),
        A(3.0, "votes"),
    ]),

    dict(key="outro", beats=[
        A(1.8, "next"),
        S("Mega", "Next time, on Odds and Ends:", "happy", act="next"),
        S("Mega", "the lawnmower.", "smug", act="next"),
        S("Spork", "I KNEW IT.", "shock", act="next"),
        A(2.2, "next"),
        A(7.0, "endcard"),
    ]),
]


# ---------------------------------------------------------------- scenes ---

PREV = {"g_prev1": (ep01, 162.0, 6.0), "g_prev2": (ep02, 146.0, 3.0),
        "g_prev3": (ep03, 176.0, 3.0), "g_prev4": (ep04, 207.0, 3.0),
        "g_prev5": (ep05, 118.0, 3.0), "g_prev6": (ep06, 188.0, 3.0),
        "g_prev7": (ep07, 178.0, 3.0), "g_prev8": (ep08, 262.0, 5.0)}
ALL_S1 = ["Volt", "Cube", "Sticky", "Clip", "Mitt", "Plate", "Spork", "Mugsy",
          "Cone"]
MEET_X = {n: 380 + i * 140 for i, n in enumerate(NEW)}
BACK_X = {n: 560 + i * 100 for i, n in enumerate(BACK)}
POOL_X = {n: 190 + i * 100 for i, n in enumerate(NEW + BACK)}
SHARP_X = {n: 150 + i * 90 for i, n in enumerate(SHARP)}
SOFT_X = {n: 770 + i * 90 for i, n in enumerate(SOFT)}
PICKS = [("Spanner", "I pick Cone", "Cone"), ("Mugsy", "I pick... Sticky", "Sticky"),
         ("Spanner", "Volt.", "Volt"), ("Mugsy", "Fuzz, I suppose", "Fuzz"),
         ("Spanner", "Clip.", "Clip"), ("Mugsy", "Gloss. Reel.", "Gloss"),
         ("Mugsy", "Gloss. Reel.", "Reel"), ("Spanner", "Fine. Bulb", "Bulb")]
LADDER_X, LADDER_LEAN = 850, -130
LADDER_H = GROUND - stage.SHELF_Y - 14
CLIMB_X = {"Cone": 830, "Spanner": 720, "Volt": 640, "Bulb": 560,
           "Mugsy": 300, "Sticky": 250, "Fuzz": 160, "Gloss": 440, "Reel": 500}
ROPE_TOP = (612, stage.SHELF_Y + 20)
ELIM_X = {n: 300 + i * 190 for i, n in enumerate(NOMINEES)}


def line_time(sc, who, prefix):
    for b in sc["beats"]:
        if b["kind"] == "say" and b["who"] == who and b["text"].startswith(prefix):
            return b["t0"]
    return None


def box_crew(cr, show, beat, T, x, w, members, scale=0.34, label="KITCHEN MISC"):
    stage.cardboard_box(cr, x, GROUND, w, 170, label)
    n = len(members)
    rows = [members] if n <= 5 else [members[:(n + 1) // 2], members[(n + 1) // 2:]]
    for r, row in enumerate(rows):
        yy = GROUND - 34 - (len(rows) - 1 - r) * 40
        for i, name in enumerate(row):
            fx = x - w / 2 + 34 + (w - 68) * (i + 0.5) / len(row)
            CAST[name].draw(cr, pose(fx, yy, s=scale * (0.9 if r == 0 and
                                                         len(rows) > 1 else 1.0),
                                     rot=0.2 if name == "Sticky" else 0.0,
                                     expr=facial(beat, name, "flat"),
                                     mouth=speaks(show, beat, name, T)), T)


def sc_previously(cr, show, sc, beat, T):
    t0, t1, act = show.act_span(sc, T)
    mod, src, span = PREV.get(act, PREV["g_prev1"])
    lt = T - t0
    Tx = src + lt * (span / max(0.6, t1 - t0))
    ep = mod.EPISODE
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
    rrect(cr, 28, 26, 400, 46, 12)
    set_rgb(cr, (0.12, 0.11, 0.18), 0.85)
    cr.fill()
    text_at(cr, 228, 58, "PREVIOUSLY, ON SERIES ONE", 24, (1, 0.86, 0.30),
            "center")


def sc_box(cr, show, sc, beat, T):
    light_t = show.act_start(sc, "g_light")
    light = 0.22 if light_t is None or T < light_t + 0.3 else \
        lerp(0.22, 1.0, ease_out(clamp((T - light_t - 0.3) / 0.5)))
    stage.garage(cr, T, light=light)
    box_crew(cr, show, beat, T, 400, 400, ALL_S1, 0.36)
    stage.chair(cr, 590, GROUND - 30, 0.55, T)
    if light_t is not None and T > light_t:
        k = ease_out(clamp((T - light_t) / 1.4))
        CAST["Mega"].draw(cr, idle("Mega", T, x=lerp(1500, 960, k), s=1.0,
                                   expr=facial(beat, "Mega", "smug"),
                                   mouth=speaks(show, beat, "Mega", T),
                                   look=(-1, 0), step=T * 9 if k < 1 else None),
                          T)
    if light < 0.5:
        stage.vignette(cr, 0.7)
        text_at(cr, W / 2, 80, "THE GARAGE, 6:40 AM", 28, (0.85, 0.85, 0.9),
                "center", bold=False, alpha=clamp((T - sc["t0"]) / 0.8))
    fl = show.since("click", T, 0.3)
    if fl is not None and light_t is not None and T > light_t:
        stage.flash(cr, (1 - fl / 0.3) * 0.5)


def sc_title(cr, show, sc, beat, T):
    t = T - sc["t0"]
    set_rgb(cr, (0.36, 0.30, 0.22))
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
        stage.logo(cr, W / 2, 280, lerp(3.4, 1.0, ease_out(k)), 1.0,
                   sub='Series 2 — Episode 1: "The Garage"'
                   if t > slam + 0.9 else None,
                   sub_a=clamp((t - slam - 0.9) / 0.5))
        text_at(cr, W / 2, 408, "SERIES TWO", 30, (1, 0.86, 0.30), "center",
                outline=(0.12, 0.11, 0.18), outline_w=8,
                alpha=clamp((t - slam - 1.4) / 0.5))
    fl = show.since("slam", T, 0.35)
    if fl is not None:
        stage.flash(cr, (1 - fl / 0.35) * 0.55)
    for i, name in enumerate(NEW + BACK):
        st = slam + 1.7 + i * 0.2
        if t < st:
            continue
        k = clamp((t - st) / 0.55)
        CAST[name].draw(cr, pose(120 + i * 116, GROUND + 120 - bounce(k) * 120,
                                 s=0.66, sq=1 + 0.12 * (1 - k)), T)


def sc_meet(cr, show, sc, beat, T):
    t0, t1, act = show.act_span(sc, T)
    focus = act.split("g_meet_", 1)[1] if act and act.startswith("g_meet_") else None
    zoom, cx = 1.0, W / 2
    if focus:
        k = ease_in_out(clamp((T - t0) / 0.5))
        zoom, cx = lerp(1.0, 1.4, k), lerp(W / 2, MEET_X[focus], k)
    elif act == "g_lineup":
        k = ease_in_out(clamp((T - t0) / 0.6))
        zoom, cx = lerp(1.4, 1.0, k), lerp(MEET_X["Reel"], W / 2, k)
    cr.save()
    camera(cr, zoom, cx, 440)
    stage.garage(cr, T)
    box_crew(cr, show, beat, T, 1150, 240, ALL_S1, 0.24)
    for name in NEW:
        x = MEET_X[name]
        p = idle(name, T, x=x, s=0.95, expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T), look=look_at(x, 180))
        if focus == name:
            k = clamp((T - t0) / 0.45)
            p["y"] -= bounce(k) * 40 if k < 1 else 0
        if name == "Fuzz" and (focus == "Fuzz" or act == "g_lineup"):
            p["y"] -= abs(math.sin(T * 6)) * 70
        CAST[name].draw(cr, p, T)
    CAST["Mega"].draw(cr, idle("Mega", T, x=180, s=1.0,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(1, 0), flip=True), T)
    cr.restore()
    if focus:
        ch = CAST[focus]
        stage.nameplate(cr, W / 2, 88, ch.name, ch.blurb, ch.tag,
                        clamp((T - t0) / 0.4))


def sc_returnees(cr, show, sc, beat, T):
    stage.garage(cr, T)
    out = [n for n in BACK if show.act_start(sc, "g_back_" + n) is not None
           and T > show.act_start(sc, "g_back_" + n)]
    box_crew(cr, show, beat, T, 1160, 230, [n for n in ALL_S1 if n not in out],
             0.26)
    for name in out:
        st = show.act_start(sc, "g_back_" + name)
        k = ease_out(clamp((T - st) / 1.6))
        x = lerp(1160, BACK_X[name], k)
        CAST[name].draw(cr, idle(name, T, x=x, s=0.82,
                                 expr=facial(beat, name),
                                 mouth=speaks(show, beat, name, T),
                                 look=look_at(x, 260),
                                 step=T * 10 if k < 1 else None), T)
    CAST["Mega"].draw(cr, idle("Mega", T, x=280, s=1.0,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(1, 0), flip=True), T)
    text_at(cr, W / 2, 70, "THE RETURNEES", 44, (1, 0.86, 0.30), "center",
            outline=(0.12, 0.11, 0.18), outline_w=9,
            alpha=clamp((T - sc["t0"]) / 0.6))


def sc_teams(cr, show, sc, beat, T):
    stage.garage(cr, T)
    box_crew(cr, show, beat, T, 1160, 230, BOX, 0.28)
    names_t = show.act_start(sc, "g_names")
    for name in NEW + BACK:
        x = POOL_X[name]
        if name in ("Spanner", "Mugsy"):
            x = SHARP_X[name] if name == "Spanner" else SOFT_X[name]
        for who, prefix, picked in PICKS:
            if picked != name:
                continue
            pt = line_time(sc, who, prefix)
            if pt is not None and T > pt + 0.4:
                k = ease_in_out(clamp((T - pt - 0.4) / 1.2))
                target = SHARP_X[name] if name in SHARP else SOFT_X[name]
                x = lerp(POOL_X[name], target, k)
        p = idle(name, T, x=x, s=0.74, expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T), look=look_at(x, 640))
        if name == "Fuzz":
            p["y"] -= abs(math.sin(T * 5.5)) * 30
        CAST[name].draw(cr, p, T)
    CAST["Mega"].draw(cr, idle("Mega", T, x=640, s=0.95,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(0, 0)), T)
    if names_t is not None and T > names_t + 1.0:
        a = clamp((T - names_t - 1.0) / 0.5)
        text_at(cr, 330, 300, "SHARP OBJECTS", 34, (1, 1, 1), "center",
                outline=(0.42, 0.46, 0.54), outline_w=8, alpha=a)
        text_at(cr, 950, 300, "SOFT OBJECTS", 34, (1, 1, 1), "center",
                outline=(0.31, 0.55, 0.86), outline_w=8, alpha=a)


def ladder_point(f, rot=0.0):
    """A point f of the way up the ladder, in world space."""
    lx = LADDER_X + LADDER_LEAN * f
    ly = GROUND - LADDER_H * f
    if rot:
        dx, dy = lx - LADDER_X, ly - GROUND
        c, s_ = math.cos(rot), math.sin(rot)
        return LADDER_X + dx * c - dy * s_, GROUND + dx * s_ + dy * c
    return lx, ly


def sc_climb(cr, show, sc, beat, T):
    go = show.act_start(sc, "g_go")
    rope = show.act_start(sc, "g_rope")
    bounce_t = show.act_start(sc, "g_bounce")
    spill = show.act_start(sc, "g_spill")
    dark = show.act_start(sc, "g_dark")
    back = show.act_start(sc, "g_lightback")
    climb3 = show.act_start(sc, "g_climb3")
    crash = show.act_start(sc, "g_crash")
    top = show.act_start(sc, "g_top")
    started = go is not None and T > go

    light = 1.0
    if dark is not None and T > dark:
        light = 0.18
    if back is not None and T > back:
        light = lerp(0.18, 1.0, ease_out(clamp((T - back) / 0.4)))
    spill_k = 0.0 if spill is None else ease_out(clamp((T - spill - 1.0) / 1.6))

    stage.garage(cr, T, light=light, spill=spill_k)
    box_crew(cr, show, beat, T, 1160, 230, BOX, 0.28)

    # the ladder, until Cone makes a legal point
    rot = 0.0
    if crash is not None and T > crash + 0.8:
        rot = -1.32 * ease_in_out(clamp((T - crash - 0.8) / 1.0))
    stage.ladder(cr, LADDER_X, GROUND, LADDER_H, LADDER_LEAN, rot)

    # Reel unwound: a cable from Reel up over the shelf
    if rope is not None and T > rope:
        k = ease_out(clamp((T - rope) / 2.4))
        pts = [(CLIMB_X["Reel"] + 40, GROUND - 30),
               (lerp(CLIMB_X["Reel"] + 60, 560, k), lerp(GROUND - 60, 330, k)),
               (lerp(CLIMB_X["Reel"] + 80, ROPE_TOP[0], k),
                lerp(GROUND - 80, ROPE_TOP[1], k))]
        stage.cable(cr, pts)

    poses = {}
    for name in SHARP + SOFT:
        x, y, s, rot_c = CLIMB_X.get(name, 600), GROUND, 0.9, 0.0
        extra = {}
        if not started:
            x = SHARP_X[name] if name in SHARP else SOFT_X[name]
        if name == "Clip" and started:
            f = 0.15
            for a_name, f_to in (("g_climb1", 0.45), ("g_climb2", 0.72),
                                 ("g_climb3", 0.92)):
                at = show.act_start(sc, a_name)
                if at is not None and T > at:
                    f = f_to
            f = min(f, 0.92)
            x, y = ladder_point(f, rot)
            x -= 40
            rot_c = rot
        if name == "Cone" and crash is not None and T > crash:
            x = lerp(CLIMB_X["Cone"], 960, ease_in_out(clamp((T - crash) / 0.8)))
            extra["arm_r"] = 1.1
        if name == "Fuzz" and started:
            amp = 60
            if bounce_t is not None and T > bounce_t:
                amp = lerp(60, 560, clamp((T - bounce_t) / 2.0))
            if top is not None and T > top:
                amp = 0
            y = GROUND - abs(math.sin(T * 4.2)) * amp
            if top is not None and T > top:
                x, y = 690, stage.SHELF_Y - 4
                k = clamp((T - top) / 0.6)
                y = lerp(-80, stage.SHELF_Y - 4, ease_out(k)) if k < 1 else y
        if name == "Gloss" and spill is not None and T > spill + 0.6:
            rot_c = 1.45 * ease_out(clamp((T - spill - 0.6) / 0.8))
            x += 40 * ease_out(clamp((T - spill - 0.6) / 0.8))
        if name == "Mugsy" and climb3 is not None and T > climb3:
            k = ease_in_out(clamp((T - climb3) / 8.0))
            x = lerp(CLIMB_X["Mugsy"], ROPE_TOP[0] - 30, k)
            y = lerp(GROUND, ROPE_TOP[1] + 100, k)
            extra["arm_r"] = 1.3
            if top is not None and T > top + 0.5:
                kk = ease_out(clamp((T - top - 0.5) / 0.5))
                x = lerp(x, 640, kk)
                y = lerp(y, stage.SHELF_Y - 4, kk)
        if name == "Sticky":
            if climb3 is not None and T > climb3:
                mx, my = poses["Mugsy"]["x"], poses["Mugsy"]["y"]
                x, y, rot_c = mx + 62, my + 6, 0.35
            elif rope is not None and T > rope:
                x, y, rot_c = CLIMB_X["Volt"] + 62, GROUND, 0.3
        p = idle(name, T, x=x, y=y, s=s, expr=facial(beat, name),
                 mouth=speaks(show, beat, name, T), rot=rot_c, **extra)
        if name == "Mugsy" and climb3 is not None and T > climb3:
            p["y"] = y
        poses[name] = p

    order = SHARP + SOFT
    for name in order:
        if light < 0.5 and name != "Bulb":
            silhouette(cr, CAST[name], poses[name], T, alpha=0.9)
        else:
            CAST[name].draw(cr, poses[name], T)
    if light < 0.5:
        glow_eyes(cr, poses["Bulb"]["x"], poses["Bulb"]["y"] - 96, 0.9, 14,
                  (1, 0.95, 0.6), 0.5 + 0.4 * math.sin(T * 9))

    CAST["Mega"].draw(cr, idle("Mega", T, x=1030, s=0.85,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    if crash is not None and T > crash + 1.6:
        stage.flash(cr, clamp(1 - (T - crash - 1.6) / 0.4) * 0.35, (1, 0.9, 0.8))
    if top is not None and T > top + 0.6:
        stage.confetti(cr, T - top - 0.6, 60)
        stage.banner(cr, 40, "SOFT OBJECTS WIN!", clamp((T - top - 0.6) / 0.4),
                     (0.31, 0.55, 0.86))
    if light < 0.5:
        stage.vignette(cr, 0.7)


def sc_results(cr, show, sc, beat, T):
    stage.garage(cr, T, spill=1.0)
    box_crew(cr, show, beat, T, 1160, 230, BOX, 0.28)
    stage.ladder(cr, LADDER_X, GROUND, LADDER_H, LADDER_LEAN, -1.32)
    CAST["Mugsy"].draw(cr, idle("Mugsy", T, y=stage.SHELF_Y - 4, x=640, s=0.9,
                                expr=facial(beat, "Mugsy", "worried"),
                                mouth=speaks(show, beat, "Mugsy", T)), T)
    CAST["Sticky"].draw(cr, pose(702, stage.SHELF_Y + 2, s=0.9, rot=0.35,
                                 expr=facial(beat, "Sticky", "beam"),
                                 mouth=speaks(show, beat, "Sticky", T)), T)
    CAST["Fuzz"].draw(cr, idle("Fuzz", T, y=stage.SHELF_Y - 4, x=780, s=0.9,
                               expr=facial(beat, "Fuzz", "beam"),
                               mouth=speaks(show, beat, "Fuzz", T)), T)
    for i, (name, rot) in enumerate((("Spanner", 0.0), ("Volt", 0.0),
                                     ("Clip", 1.2), ("Bulb", 0.4),
                                     ("Cone", 0.0))):
        x = 300 + i * 120
        CAST[name].draw(cr, idle(name, T, x=x, s=0.85, rot=rot,
                                 expr=facial(beat, name, "sad" if rot else "flat"),
                                 mouth=speaks(show, beat, name, T),
                                 look=(1, 0)), T)
    CAST["Gloss"].draw(cr, idle("Gloss", T, x=170, s=0.8, rot=1.4,
                                expr=facial(beat, "Gloss", "sad"),
                                mouth=speaks(show, beat, "Gloss", T)), T)
    CAST["Reel"].draw(cr, idle("Reel", T, x=940, s=0.85,
                               expr=facial(beat, "Reel", "worried"),
                               mouth=speaks(show, beat, "Reel", T),
                               look=(1, 0)), T)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1040, s=0.9,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    stage.scorecard(cr, 330, 262, "Sharp Objects", "the floor",
                    (0.42, 0.46, 0.54), clamp((T - sc["t0"]) / 0.5), w=300,
                    size=30)
    stage.scorecard(cr, 950, 262, "Soft Objects", "the shelf",
                    (0.31, 0.55, 0.86), clamp((T - sc["t0"]) / 0.5), w=300,
                    size=30)


def sc_elimination(cr, show, sc, beat, T):
    votes = show.act_start(sc, "votes")
    stage.dark_stage(cr, T, spots=[(ELIM_X[n], 100, 1.0) for n in NOMINEES])
    box_crew(cr, show, beat, T, 110, 200, BOX, 0.24)
    for name in NOMINEES:
        x = ELIM_X[name]
        stage.podium(cr, x, GROUND + 10, 120, 120)
        CAST[name].draw(cr, idle(name, T, y=GROUND + 4, x=x, s=0.72,
                                 expr=facial(beat, name, "flat"),
                                 mouth=speaks(show, beat, name, T),
                                 look=look_at(x, 1200)), T)
        if votes is not None and T > votes:
            k = clamp((T - votes - NOMINEES.index(name) * 0.18) / 0.4)
            stage.scorecard(cr, x, 290, name, "vote", CAST[name].tag, k,
                            w=160, size=30)
    CAST["Mega"].draw(cr, idle("Mega", T, x=1200, s=0.85,
                               expr=facial(beat, "Mega", "smug"),
                               mouth=speaks(show, beat, "Mega", T),
                               look=(-1, 0)), T)
    text_at(cr, W / 2, 70, "ELIMINATION: SHARP OBJECTS", 44, (1, 0.86, 0.30),
            "center", outline=(0.12, 0.11, 0.18), outline_w=10,
            alpha=clamp((T - sc["t0"]) / 0.6))
    if votes is not None and T > votes:
        text_at(cr, W / 2, 116, "vote in the comments", 28, (1, 1, 1),
                "center", bold=False, alpha=clamp((T - votes) / 0.5))
    stage.vignette(cr, 0.45)


def lawnmower(cr, x, y, s, t):
    from draw import circle, fill_stroke, rrect
    if s <= 0.002:
        return
    cr.save()
    cr.translate(x, y)
    cr.scale(s, s)
    rrect(cr, -120, -90, 200, 80, 14)
    fill_stroke(cr, (0.28, 0.58, 0.32), 5.0)
    rrect(cr, -70, -130, 90, 44, 10)
    fill_stroke(cr, (0.22, 0.22, 0.26), 4.5)
    cr.new_path()
    cr.move_to(70, -80)
    cr.line_to(190, -230)
    stroke_out = __import__("draw").stroke_out
    stroke_out(cr, 9.0, (0.30, 0.30, 0.34))
    rrect(cr, 170, -246, 60, 18, 8)
    fill_stroke(cr, (0.22, 0.22, 0.26), 4.5)
    for wx in (-90, 60):
        circle(cr, wx, -10, 24)
        fill_stroke(cr, (0.16, 0.16, 0.20), 4.5)
    cr.restore()


def sc_outro(cr, show, sc, beat, T):
    end = show.act_start(sc, "endcard", sc["t1"])
    stage.dark_stage(cr, T, spots=[(640, 260, 0.7)])
    if T < end:
        t = T - sc["t0"]
        text_at(cr, W / 2, 130, "NEXT TIME ON", 40, (1, 1, 1), "center",
                alpha=clamp(t / 0.5))
        stage.logo(cr, W / 2, 220, 0.62, clamp(t / 0.5))
        lawnmower(cr, 640, GROUND, 1.0 * ease_out(clamp((t - 0.8) / 0.9)), T)
        box_crew(cr, show, beat, T, 160, 220, BOX, 0.26)
        CAST["Mega"].draw(cr, idle("Mega", T, x=1120, s=0.9,
                                   expr=facial(beat, "Mega", "smug"),
                                   mouth=speaks(show, beat, "Mega", T),
                                   look=(-1, 0)), T)
    else:
        t = T - end
        stage.logo(cr, W / 2, 250, lerp(1.25, 1.0, ease_out(clamp(t / 0.8))),
                   1.0, sub='Series 2 — Episode 2: "The Lawnmower"',
                   sub_a=clamp((t - 0.7) / 0.6))
        for i, name in enumerate(NEW + BACK):
            st = 0.4 + i * 0.12
            if t < st:
                continue
            k = clamp((t - st) / 0.5)
            CAST[name].draw(cr, pose(120 + i * 116, GROUND + 120 - bounce(k) * 120,
                                     s=0.66), T)
        text_at(cr, W / 2, 400, "VOTE IN THE COMMENTS", 30, (1, 1, 1),
                "center", alpha=clamp((t - 1.3) / 0.6))
    stage.vignette(cr, 0.4)


SCENE_FN = {
    "previously": sc_previously, "box": sc_box, "title": sc_title,
    "meet": sc_meet, "returnees": sc_returnees, "teams": sc_teams,
    "climb": sc_climb, "results": sc_results, "elimination": sc_elimination,
    "outro": sc_outro,
}

EPISODE = Show("s2e01", 'Series 2, Episode 1: "The Garage"', BEATS, TOTAL,
               SCENE_FN)
