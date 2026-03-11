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
            
            "land": "LAND",
            "touch down": "LAND",
            "ground": "LAND",
            
            "return to launch": "RTL",
            "return to home": "RTL",
            "rtl": "RTL",
            "come back": "RTL",
            "go home": "RTL",
            
            "forward": "MOVE_FORWARD",
            "move forward": "MOVE_FORWARD",
            "go forward": "MOVE_FORWARD",
            "ahead": "MOVE_FORWARD",
            
            "backward": "MOVE_BACKWARD",
            "move backward": "MOVE_BACKWARD",
            "go back": "MOVE_BACKWARD",
            "reverse": "MOVE_BACKWARD",
            
            "left": "MOVE_LEFT",
            "move left": "MOVE_LEFT",
            "go left": "MOVE_LEFT",
            
            "right": "MOVE_RIGHT",
            "move right": "MOVE_RIGHT",
            "go right": "MOVE_RIGHT",
            
            "up": "MOVE_UP",
            "move up": "MOVE_UP",
            "go up": "MOVE_UP",
            "ascend": "MOVE_UP",
            "climb": "MOVE_UP",
            
            "down": "MOVE_DOWN",
            "move down": "MOVE_DOWN",
            "go down": "MOVE_DOWN",
            "descend": "MOVE_DOWN",
            "drop": "MOVE_DOWN",
            
            "rotate left": "ROTATE_CCW",
            "turn left": "ROTATE_CCW",
            "yaw left": "ROTATE_CCW",
            "spin left": "ROTATE_CCW",
            
            "rotate right": "ROTATE_CW",
            "turn right": "ROTATE_CW",
            "yaw right": "ROTATE_CW",
            "spin right": "ROTATE_CW",
            
            "hover": "HOLD",
            "hold": "HOLD",
            "stop": "HOLD",
            "brake": "HOLD",
            "stay": "HOLD",
            
            "arm": "ARM",
            "disarm": "DISARM",
        }
        
        # List of all known command phrases for fuzzy matching
        self.known_phrases = list(self.intent_map.keys())

    def _extract_number(self, doc, default=None):
        for token in doc:
            if token.like_num:
                try:
                    return int(token.text)
                except:
                    pass
        # Fallback to word-to-number mapping for common misrecognitions
        text = doc.text
        words_to_num = {"one": 1, "two": 2, "to": 2, "too": 2, "three": 3, "tree": 3, "four": 4, "for": 4, 
                        "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
        for word, num in words_to_num.items():
            if re.search(r'\b' + word + r'\b', text):
                return num
                
        return default

    def parse(self, text: str):
        t = text.lower().strip()
        doc = self.nlp(t)
        
        # Remove numbers from the string before fuzzy matching to avoid throwing off the score
        text_no_nums = re.sub(r'\d+', '', t).strip()
        text_no_nums = ' '.join([w for w in text_no_nums.split() if w not in ["one", "two", "to", "too", "three", "tree", "four", "for", "five", "six", "seven", "eight", "nine", "ten", "meters", "meter", "degrees", "degree"]])

        # 1. Try exact match first (substring)
        for phrase, intent in self.intent_map.items():
            if phrase in t:
                return (intent, self._get_default_value(doc, intent))

        # 2. Try Fuzzy Matching using difflib
        if text_no_nums:
            matches = difflib.get_close_matches(text_no_nums, self.known_phrases, n=1, cutoff=0.6)
            if matches:
                best_match = matches[0]
                intent = self.intent_map[best_match]
                return (intent, self._get_default_value(doc, intent))

        # 3. Last fallback for specific tricky cases
        if "rtl" in t: return ("RTL", None)
        
        return ("UNKNOWN", None)
        
    def _get_default_value(self, doc, intent):
        if intent in ["TAKEOFF"]: return self._extract_number(doc, 10)
        if intent in ["MOVE_FORWARD", "MOVE_BACKWARD", "MOVE_LEFT", "MOVE_RIGHT"]: return self._extract_number(doc, 5)
        if intent in ["MOVE_UP", "MOVE_DOWN"]: return self._extract_number(doc, 2)
        if intent in ["ROTATE_CW", "ROTATE_CCW"]: return self._extract_number(doc, 30)
        return None
