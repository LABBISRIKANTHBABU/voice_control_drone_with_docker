import re
import spacy

class DroneNLP:
    def __init__(self):
        self.nlp = spacy.load("en_core_web_sm")

    def _extract_number(self, doc, default=None):
        for token in doc:
            if token.like_num:
                try:
                    return int(token.text)
                except:
                    pass
        return default

    def parse(self, text: str):
        t = text.lower().strip()
        doc = self.nlp(t)

        if "return to launch" in t or "rtl" in t or "return home" in t:
            return ("RTL", None)

        if "take off" in t or "takeoff" in t:
            return ("TAKEOFF", self._extract_number(doc, 10))

        if "land" in t:
            return ("LAND", None)

        if "forward" in t:
            return ("MOVE_FORWARD", self._extract_number(doc, 5))

        if "backward" in t:
            return ("MOVE_BACKWARD", self._extract_number(doc, 5))

        if re.search(r"\bleft\b", t):
            return ("MOVE_LEFT", self._extract_number(doc, 5))

        if re.search(r"\bright\b", t):
            return ("MOVE_RIGHT", self._extract_number(doc, 5))

        if "up" in t or "ascend" in t:
            return ("MOVE_UP", self._extract_number(doc, 2))

        if "down" in t or "descend" in t:
            return ("MOVE_DOWN", self._extract_number(doc, 2))

        if "rotate" in t or "turn" in t or "yaw" in t:
            deg = self._extract_number(doc, 30)
            if "left" in t:
                return ("ROTATE_CCW", deg)
            return ("ROTATE_CW", deg)

        if "hover" in t or "hold" in t:
            return ("HOLD", None)

        if "arm" in t and "disarm" not in t:
            return ("ARM", None)

        if "disarm" in t:
            return ("DISARM", None)

        return ("UNKNOWN", None)
