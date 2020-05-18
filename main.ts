/**
* jinwoo park @ c3coding
* 18 May 2020
* https://blog.naver.com/miriele
* https://www.c3coding.com/
* 
* https://github.com/miriele/microbit_cjmcu811
* 
* Based in the work of Mary West @ SparkFun Electronics
* 
* Mary West @ SparkFun Electronics 
* Ryan Mortenson https://github.com/ryanjmortenson
* August 25, 2017
* https://github.com/ADataDate/pxt-CCS811
* 
* Development environment specifics:
* Written in Microsoft Makecode
* Tested with a CJMCU-811 sensor for micro:bit
*
* This code is released under the [MIT License](http://opensource.org/licenses/MIT).
* Please review the LICENSE.txt file included with this example. If you have any questions 
* or concerns with licensing, please contact miriele75@gmail.com.
* Distributed as-is; no warranty is given.
*/

enum CCS811_I2C_ADDRESS
{
    //% block="0x5A"
    ADDR_0x5A   = 0x5A,
    //% block="0x5B"
    ADDR_0x5B   = 0x5B
}

enum CCS811_DRIVE_MODE
{
    //% block="None"
    measDM0     = 0x00, // Idle (Measurements are disabled in this mode)
    //% block="1 Sec"
    measDM1     = 0x10, // Constant power mode, IAQ measurement every second
    //% block="10 Sec"
    measDM2     = 0x20, // Pulse heating mode IAQ measurement every 10 seconds
    //% block="60 Sec"
    measDM3     = 0x30, // Low power pulse heating mode IAQ measurement every 60 seconds
}

    //Measure Mode Register : INT_DATARDY

    //Measure Mode Register : INT_THRESH

//% color=#33acff icon="\u27BE"
namespace miriele_cjmcu811
{
    //Keep track of CCS811 Start
    let appStarted  = false;

    //CCS811 Addresses
    let ccsAddr     = 0x5A
    
    //CCS811 DriveMode
    let ccsDrvMode  = 0x20
    
    //CCS811 Register Map
    const ccsStatus = 0x00  // [1 byte] Status Register
    const ccsMeas   = 0x01  // [1 byte] Measurement mode and conditions register
    const ccsAlg    = 0x02  // [up to 8 bytes] Algorithm result. The most significant 2 bytes contain a ppm estimate of the equivalent CO2 (eCO2) level, and
                            // the next two bytes contain a ppb estimate of the total VOC level.
    const ccsRaw    = 0x03  // [2 bytes] Raw ADC data values for resistance and current source used.
    const ccsEnv    = 0x05  // [4 bytes] Temperature and Humidity data can be written to enable compensation
    const ccsNtc    = 0x06  // [4 bytes] Provides the voltage across the reference resistor and the voltage across the NTC resistor – from which the
                            // ambient temperature can be determined.
    const ccsThres  = 0x10  // [5 bytes] Thresholds for operation when interrupts are only generated when eCO2 ppm crosses a threshold
    const ccsBase   = 0x11  // [2 bytes] The encoded current baseline value can be read. A previously saved encoded baseline can be written.
    const ccsHi     = 0x20  // [1 byte] Hardware ID. The value is 0x81
    const ccsHv     = 0x21  // [1 byte] Hardware Version. The value is 0x1X
    const ccsBoot   = 0x23  // [2 bytes] Firmware Boot Version. The first 2 bytes contain the firmware version number for the boot code.
    const ccsAppv   = 0x24  // [2 bytes] Firmware Application Version. The first 2 bytes contain the firmware version number for the application code.
    const ccsErr    = 0xE0  // [1 byte] Error ID. When the status register reports an error it source is located in this register

    const ccsApps   = 0xF4  // Application start. Used to transition the CCS811 state from boot to application mode, a write with no data is
                            // required. Before performing a write to APP_START the Status register should be accessed to check if there is a valid application present.
    const ccsReset  = 0xFF  // [4 bytes] If the correct 4 bytes (0x11 0xE5 0x72 0x8A) are written to this register in a single sequence the device will reset
                            // and return to BOOT mode.

	/**
     *  Easy test for ensuring I2C read is working
     */

    //% weight=1 blockId="hardwareID" block="HWID"
    export function hardwareID(): number
    {
        let hardwareId = readCCSReg(ccsHi, NumberFormat.UInt8LE)
        return hardwareId
    }


    /**
     * Gets the CO2 data from the algorithm register
     * of the CCS811 Air Quality Sensor
     */

    //% weight=100 blockId="readCo2" block="Read eCO2"
    export function readCo2(): number
    {
        //read Algorithm Results register

        let algRes = readCCSReg(ccsAlg, NumberFormat.UInt16BE)
        return algRes
    }

    /**
     * Gets the TVOC data from the algorithm register
     * of the CCS811 Air Quality Sensor
     */

    //% weight=90 blockId="readTvoc" block="Read TVOCs"
    export function readTvoc(): number
    {
        //read Algorithm Results register
        let algRes = readCCSReg(ccsAlg, NumberFormat.Int32BE)
        let Tvoc = (algRes & 0x0000FFFF)
        return Tvoc
    }

    //% weight=2 blockId="readStatus" block="Device Status"
    export function readStatus(): number
    {
        //Return status of Device
        let status = readCCSReg(ccsStatus, NumberFormat.UInt8LE)
        return status
    }

    /**
     * Read the device error code if there are
     * any problems with device
     */

    //% weight=3 blockId="readError" block="Device Error"
    export function readError(): number
    {
        //Return Error of Device
        let error = readCCSReg(ccsErr, NumberFormat.Int8LE)
        return error
    }


	/**
     * Writes a value to a register on the CCS811 Air Quality Sensor
     */
    function writeCCSReg(reg: number, val: number): void
    {
        let test = reg << 8 | val
        pins.i2cWriteNumber(ccsAddr, reg << 8 | val, NumberFormat.Int16BE)
    }

	/**
     * Reads a value from a register on the CCS811 Air Quality Sensor
     */
    function readCCSReg(reg: number, format: NumberFormat)
    {
        pins.i2cWriteNumber(ccsAddr, reg, NumberFormat.UInt8LE, false)
        let val = pins.i2cReadNumber(ccsAddr, format, false)
        return val
    }


	/**
     * Gets the CCS811 into app mode, and sets the measure register
     * to pull data into Algorithm register every second. 
     */

    //% weight=100 blockId="AppStart" block="CJMCU-811 Start"
    export function appStart(): void
    {
        if (appStarted) return;

        pins.i2cWriteNumber(ccsAddr, ccsApps, NumberFormat.Int8LE)
        writeCCSReg(ccsMeas, ccsDrvMode)

        //init once 
        appStarted = true;
    }

    /**
    * set I2C address
    */
    //% weight=50 blockId="AIRQUALITY_SET_ADDRESS" block="setAddress %addr"
    export function setAddress(addr: CCS811_I2C_ADDRESS)
    {
        ccsAddr = addr
    }

    /**
    * set Drive Mode
    */
    //% weight=50 blockId="setDriveMode" block="setDriveMode %mode"
    export function setDriveMode(mode: CCS811_DRIVE_MODE)
    {
        ccsDrvMode = mode
    }
}