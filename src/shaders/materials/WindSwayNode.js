import { Fn, vec4, sin, cos, positionLocal, max, positionGeometry, modelWorldMatrix, float } from 'three/tsl';

export const windSwayNode = Fn(([uTime, scale]) => {
    let transformed = positionLocal.toVar();
    transformed.mulAssign(scale);

    // Get the global origin of the current instance
    const globalPos = modelWorldMatrix.mul(vec4(0.0, 0.0, 0.0, 1.0));
    
    // Multi-frequency wind wave across the landscape
    const windWave1 = sin(uTime.mul(1.6).add(globalPos.x.mul(0.03)).add(globalPos.z.mul(0.025))).mul(0.07);
    const windWave2 = cos(uTime.mul(2.8).add(globalPos.x.mul(0.06)).add(globalPos.z.mul(0.04))).mul(0.035);
    const gustSway   = sin(uTime.mul(4.2).add(globalPos.x.mul(0.12))).mul(0.015);
    
    // Height factor: sway increases with height from trunk base
    const heightFactor = max(0.0, positionGeometry.y).div(22.0);
    const totalSway = windWave1.add(windWave2).add(gustSway).mul(heightFactor.mul(1.6));

    transformed.x.addAssign(totalSway);
    transformed.z.addAssign(totalSway.mul(0.75));

    return transformed;
});
