"""Binary64 reductions for ASCENSION reports. Historical paths retain NumPy operations."""
import math
import numpy as np


class ArrayReductions:
    dot = staticmethod(np.dot)
    norm = staticmethod(np.linalg.norm)

    @staticmethod
    def projection(rows, vector):
        return rows.T @ (rows @ vector)

    @staticmethod
    def drift(rows, delta):
        return float(np.max(np.abs(rows @ delta), initial=0.))


class OrderedReductions:
    @staticmethod
    def dot(left, right):
        return math.fsum(float(x) * float(y) for x, y in zip(left, right, strict=True))

    @classmethod
    def norm(cls, values):
        return math.sqrt(cls.dot(values, values))

    @classmethod
    def projection(cls, rows, vector):
        coefficients = [cls.dot(row, vector) for row in rows]
        return np.array([cls.dot(column, coefficients) for column in rows.T])

    @classmethod
    def drift(cls, rows, delta):
        return max((abs(cls.dot(row, delta)) for row in rows), default=0.)
