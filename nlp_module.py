import re
import spacy
import difflib

class DroneNLP:
    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")
        
        # Comprehensive intent dictionary mapping canonical commands to their intent types
        self.intent_map = {
            "takeoff": "TAKEOFF",
            "take off": "TAKEOFF",
            "launch": "TAKEOFF",
            "fly": "TAKEOFF",
            "lift off": "TAKEOFF",
            "get airborne": "TAKEOFF",
            "start flying": "TAKEOFF",
            "go up in the air": "TAKEOFF",
            
            "land": "LAND",
            "touch down": "LAND",
            "ground": "LAND",
            "come down": "LAND",
            "land now": "LAND",
            "get on the ground": "LAND",
            
            "return to launch": "RTL",
            "return to home": "RTL",
            "rtl": "RTL",
            "come back": "RTL",
            "go home": "RTL",
            "return": "RTL",
            "come to home": "RTL",
            "come back here": "RTL",
            "head back": "RTL",
            "abort to home": "RTL",
            
            "forward": "MOVE_FORWARD",
            "move forward": "MOVE_FORWARD",
            "go forward": "MOVE_FORWARD",
            "ahead": "MOVE_FORWARD",
            "go ahead": "MOVE_FORWARD",
            "fly forward": "MOVE_FORWARD",
            "push forward": "MOVE_FORWARD",
            
            "backward": "MOVE_BACKWARD",
            "move backward": "MOVE_BACKWARD",
            "go back": "MOVE_BACKWARD",
            "reverse": "MOVE_BACKWARD",
            "fly backward": "MOVE_BACKWARD",
            "move back": "MOVE_BACKWARD",
            "back up": "MOVE_BACKWARD",
            
            "left": "MOVE_LEFT",
            "move left": "MOVE_LEFT",
            "go left": "MOVE_LEFT",
            "fly left": "MOVE_LEFT",
            "strafe left": "MOVE_LEFT",
            "slide left": "MOVE_LEFT",
            
            "right": "MOVE_RIGHT",
            "move right": "MOVE_RIGHT",
            "go right": "MOVE_RIGHT",
            "fly right": "MOVE_RIGHT",
            "strafe right": "MOVE_RIGHT",
            "slide right": "MOVE_RIGHT",
            
            "up": "MOVE_UP",
            "move up": "MOVE_UP",
            "go up": "MOVE_UP",
            "ascend": "MOVE_UP",
            "climb": "MOVE_UP",
            "fly up": "MOVE_UP",
            "increase altitude": "MOVE_UP",
            "higher": "MOVE_UP",
            "go higher": "MOVE_UP",
            
            "down": "MOVE_DOWN",
            "move down": "MOVE_DOWN",
            "go down": "MOVE_DOWN",
            "descend": "MOVE_DOWN",
            "drop": "MOVE_DOWN",
            "fly down": "MOVE_DOWN",
            "decrease altitude": "MOVE_DOWN",
            "lower": "MOVE_DOWN",
            "go lower": "MOVE_DOWN",
            "loose altitude": "MOVE_DOWN",
            
            "rotate left": "ROTATE_CCW",
            "turn left": "ROTATE_CCW",
            "yaw left": "ROTATE_CCW",
            "spin left": "ROTATE_CCW",
            "look left": "ROTATE_CCW",
            "face left": "ROTATE_CCW",
            
            "rotate right": "ROTATE_CW",
            "turn right": "ROTATE_CW",
            "yaw right": "ROTATE_CW",
            "spin right": "ROTATE_CW",
            "look right": "ROTATE_CW",
            "face right": "ROTATE_CW",
            
            "hover": "HOLD",
            "hold": "HOLD",
            "stop": "HOLD",
            "brake": "HOLD",
            "stay": "HOLD",
            "hold position": "HOLD",
            "stay there": "HOLD",
            "do not move": "HOLD",
            "freeze": "HOLD",
            "stop moving": "HOLD",
            
            "arm": "ARM",
            "arm drone": "ARM",
            "start motors": "ARM",
            
            "disarm": "DISARM",
            "disarm drone": "DISARM",
            "stop motors": "DISARM",
            "kill motors": "DISARM"
        }
        
        # List of all known command phrases for fuzzy matching
        self.known_phrases = list(self.intent_map.keys())

    def _extract_number(self, doc, default=None):
        """Extract a distance/angle number from text, allowing for words and digits."""
        for token in doc:
            if token.like_num:
                try:
                    return int(token.text)
                except:
                    pass
                    
        # Fallback to word-to-number mapping for common misrecognitions
        text = doc.text.lower()
        words_to_num = {
            "one": 1, "two": 2, "to": 2, "too": 2, "three": 3, "tree": 3, 
            "four": 4, "for": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, 
            "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "twenty": 20,
            "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60, "ninety": 90, "hundred": 100
        }
        
        # Search for isolated words
        for word, num in words_to_num.items():
            if re.search(r'\b' + word + r'\b', text):
                return num
                
        return default

    def parse(self, text: str):
        t = text.lower().strip()
        doc = self.nlp(t)
        
        # Remove units and filler words before matching to improve accuracy vastly
        noise_words = [
            "meters", "meter", "degrees", "degree", "cms", "cm", "centimeters", "centimeter",
            "please", "drone", "the", "a", "an", "now", "immediately", "quick", "quickly",
            "one", "two", "to", "too", "three", "tree", "four", "for", "five", "six", 
            "seven", "eight", "nine", "ten", "eleven", "twelve", "twenty", "thirty", 
            "forty", "fifty", "sixty", "ninety", "hundred"
        ]
        
        # Strip digits
        text_no_nums = re.sub(r'\d+', '', t).strip()
        
        # Strip noise words
        clean_words = [w for w in text_no_nums.split() if w not in noise_words]
        text_clean = ' '.join(clean_words).strip()

        # 1. Try exact match first on the original text
        for phrase, intent in self.intent_map.items():
            if phrase in t:
                return (intent, self._get_default_value(doc, intent))

        # 2. Try exact match on the cleaned text (e.g., "move forward 10 meters please" -> "move forward")
        if text_clean in self.intent_map:
            intent = self.intent_map[text_clean]
            return (intent, self._get_default_value(doc, intent))
            
        # 3. Try Fuzzy Matching using difflib on the cleaned text
        if text_clean:
            # high cutoff implies it must be very similar (0.75+ instead of 0.6)
            matches = difflib.get_close_matches(text_clean, self.known_phrases, n=1, cutoff=0.75)
            if matches:
                best_match = matches[0]
                intent = self.intent_map[best_match]
                return (intent, self._get_default_value(doc, intent))

        # 4. Last fallbacks for tricky acronyms
        if "rtl" in t or "return to launch" in t: 
            return ("RTL", None)
        
        return ("UNKNOWN", None)
        
    def _get_default_value(self, doc, intent):
        if intent in ["TAKEOFF"]: return self._extract_number(doc, 10)
        if intent in ["MOVE_FORWARD", "MOVE_BACKWARD", "MOVE_LEFT", "MOVE_RIGHT"]: return self._extract_number(doc, 5)
        if intent in ["MOVE_UP", "MOVE_DOWN"]: return self._extract_number(doc, 2)
        if intent in ["ROTATE_CW", "ROTATE_CCW"]: return self._extract_number(doc, 30)
        return None
