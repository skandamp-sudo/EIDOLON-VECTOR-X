"""Protected-sphere rotation v1. Strength bounds angular travel (radians)."""
import numpy as np
from .reductions import OrderedReductions as ops


def rotate(x, target, protected, strength, min_cosine):
    """Return endpoint, signed angle and reason. Degenerate arcs abstain from movement."""
    tolerance = 1e-10
    if not strength or min_cosine == 1:
        return x.copy(), 0., "Zero angular allowance."
    fixed = np.zeros_like(x)
    projected = np.sign(strength) * target
    if len(protected):
        _, singular, vh = np.linalg.svd(protected, full_matrices=False)
        basis = vh[singular > singular[0] * max(protected.shape) * np.finfo(float).eps]
        fixed = ops.projection(basis, x)
        projected = projected - ops.projection(basis, projected)
    residual = x - fixed
    radius = ops.norm(residual)
    if radius < tolerance or ops.norm(projected) < tolerance:
        return x.copy(), 0., "No movable component or target outside the protected space."
    u = residual / radius
    along = ops.dot(projected, u)
    tangent = projected - along*u
    magnitude = ops.norm(tangent)
    if magnitude < tolerance:
        return x.copy(), 0., "Aligned or antipodal target has no unique improving tangent."
    # x·y = 1 - r²(1-cos theta). Stop at the first maximum of the
    # signed objective along this particular arc, or at either motion bound.
    fidelity_angle = np.arccos(np.clip(1-(1-min_cosine)/radius**2, -1, 1))
    angle = min(abs(strength), float(fidelity_angle), float(np.arctan2(magnitude, along)))
    y = fixed + radius * (np.cos(angle)*u + np.sin(angle)*tangent/magnitude)
    drift = ops.drift(protected, y-x)
    if (abs(ops.norm(y)-1) > tolerance or drift > tolerance
            or ops.dot(x, y) < min_cosine-tolerance or np.sign(strength)*ops.dot(target, y-x) <= 1e-12):
        return x.copy(), 0., "No numerically admissible positive signed gain."
    return y, float(np.copysign(angle,strength)), "Rotated within the protected complement."
